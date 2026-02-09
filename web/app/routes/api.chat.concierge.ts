import { data } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { getSession } from "~/lib/auth.server";
import { runConcierge } from "~/services/ai/concierge.server";
import { db } from "~/db/index.server";
import { aiChatThreads, aiChatMessages } from "~/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { v4 as uuidv4 } from "uuid";

/**
 * Handle fetching chat history (GET)
 */
export async function loader({ request }: LoaderFunctionArgs) {
    const session = await getSession(request);
    if (!session) return data({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(request.url);
    let threadId = url.searchParams.get("threadId");

    // If no threadId, find the latest thread for this user
    if (!threadId) {
        const latestThread = await db.query.aiChatThreads.findFirst({
            where: eq(aiChatThreads.userId, session.user.id),
            orderBy: [desc(aiChatThreads.createdAt)],
        });
        if (!latestThread) return data({ messages: [] });
        threadId = latestThread.id;
    }

    const messages = await db.query.aiChatMessages.findMany({
        where: eq(aiChatMessages.threadId, threadId),
        orderBy: [aiChatMessages.createdAt],
    });

    return data({ threadId, messages });
}

/**
 * Handle sending messages (POST)
 */
export async function action({ request }: ActionFunctionArgs) {
    const session = await getSession(request);
    if (!session) return data({ error: "Unauthorized" }, { status: 401 });

    const formData = await request.formData();
    const content = formData.get("content") as string;
    let threadId = formData.get("threadId") as string;

    if (!content) return data({ error: "Content is required" }, { status: 400 });

    // 1. Ensure thread exists
    if (!threadId) {
        threadId = uuidv4();
        await db.insert(aiChatThreads).values({
            id: threadId,
            userId: session.user.id,
            title: content.substring(0, 50),
        });
    }

    // 2. Save Human Message
    await db.insert(aiChatMessages).values({
        id: uuidv4(),
        threadId,
        role: "user",
        content,
    });

    // 3. Get history for AI
    const history = await db.query.aiChatMessages.findMany({
        where: eq(aiChatMessages.threadId, threadId),
        orderBy: [aiChatMessages.createdAt],
    });

    const langchainMessages = history.map(m => {
        if (m.role === "user") return new HumanMessage(m.content);
        if (m.role === "assistant") return new AIMessage(m.content);
        return new HumanMessage(m.content); // Default
    });

    // 4. Run AI
    try {
        const result = await runConcierge(threadId, langchainMessages);
        const lastMsg = result.messages[result.messages.length - 1];
        const aiResponse = lastMsg?.content?.toString() || "죄송합니다, 응답을 생성하지 못했습니다.";

        await db.insert(aiChatMessages).values({
            id: uuidv4(),
            threadId,
            role: "assistant",
            content: aiResponse,
        });

        return data({ threadId, response: aiResponse });
    } catch (error) {
        console.error("Concierge error:", error);
        return data(
            { threadId, response: "죄송합니다. 잠시 후 다시 시도해주세요." },
            { status: 500 }
        );
    }
}
