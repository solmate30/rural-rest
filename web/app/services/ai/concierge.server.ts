import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { StateGraph, Annotation, messagesStateReducer, START, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { SystemMessage, BaseMessage } from "@langchain/core/messages";
import { z } from "zod";
import { appLogicTools, transportTools, travelTools } from "./tools.server";

/**
 * AI Concierge State Definition (5-node architecture)
 */
export const StateAnnotation = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
        reducer: messagesStateReducer,
        default: () => [],
    }),
    intent: Annotation<string>({
        reducer: (_, next) => next,
        default: () => "",
    }),
    context: Annotation<Record<string, any>>({
        reducer: (prev, next) => ({ ...prev, ...next }),
        default: () => ({}),
    }),
    collectedData: Annotation<Array<{ source: string; result: string }>>({
        reducer: (prev, next) => [...prev, ...next],
        default: () => [],
    }),
    activatedExperts: Annotation<string[]>({
        reducer: (_, next) => next,
        default: () => [],
    }),
    completedExperts: Annotation<string[]>({
        reducer: (prev, next) => [...new Set([...prev, ...next])],
        default: () => [],
    }),
});

/**
 * Base model (no tools bound)
 */
if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.");
}

const baseModel = new ChatGoogleGenerativeAI({
    model: "gemini-2.0-flash",
    maxOutputTokens: 2048,
    apiKey: process.env.GEMINI_API_KEY,
});

/**
 * Router schema for structured output
 */
const routerSchema = z.object({
    intent: z.enum(["service_policy", "transport", "tourism", "complex"]),
    experts: z.array(z.enum(["app_logic", "transport", "korea_travel"])),
    extractedContext: z.object({
        listingId: z.string().optional(),
        location: z.string().optional(),
    }).optional(),
});

/**
 * Node 1: Router - intent classification + expert activation
 */
async function routerNode(state: typeof StateAnnotation.State) {
    const routerModel = baseModel.withStructuredOutput(routerSchema);
    const systemPrompt = new SystemMessage(
        `사용자 질문의 의도를 분석하여 어떤 전문가 노드를 활성화할지 결정하세요.
- service_policy: 숙소 정보, 예약 상태, 정책/수칙 → experts: ["app_logic"]
- transport: 경로, 교통편, 셔틀 → experts: ["transport"] (셔틀 정책도 필요시 ["app_logic","transport"])
- tourism: 맛집, 관광지, 문화 → experts: ["korea_travel"]
- complex: 여러 도메인이 복합된 질문 → experts에 해당하는 전문가 모두 포함`
    );

    const result = await routerModel.invoke([systemPrompt, ...state.messages]);

    return {
        intent: result.intent,
        activatedExperts: result.experts,
        context: result.extractedContext || {},
    };
}

/**
 * Expert loop helper - runs a single expert with its own tool-calling loop
 */
async function runExpertLoop(
    systemPrompt: string,
    messages: BaseMessage[],
    tools: any[],
): Promise<string> {
    const expertModel = baseModel.bindTools(tools);
    let currentMessages: BaseMessage[] = [new SystemMessage(systemPrompt), ...messages];
    let response = await expertModel.invoke(currentMessages);

    // Tool-calling loop (max 3 iterations to prevent infinite loops)
    let iterations = 0;
    while (response.tool_calls && response.tool_calls.length > 0 && iterations < 3) {
        const toolNode = new ToolNode(tools);
        const toolResults = await toolNode.invoke({
            messages: [...currentMessages, response],
        });
        currentMessages = [...currentMessages, response, ...toolResults.messages];
        response = await expertModel.invoke(currentMessages);
        iterations++;
    }

    return response.content?.toString() || "";
}

/**
 * Node 2: App Logic Expert - service policies, listing data, FAQ
 */
async function appLogicNode(state: typeof StateAnnotation.State) {
    const result = await runExpertLoop(
        `당신은 Rural Rest 서비스 정책 전문가입니다.
숙소 상세정보, 체크인/아웃 정책, 셔틀 운영, FAQ를 정확히 안내하세요.
도구를 사용해 실제 데이터를 조회하고, 모르는 것은 호스트 문의를 안내하세요.`,
        state.messages,
        appLogicTools,
    );
    return {
        collectedData: [{ source: "app_logic", result }],
        completedExperts: ["app_logic"],
    };
}

/**
 * Node 3: Transport Expert - routes, transit, shuttle
 */
async function transportExpertNode(state: typeof StateAnnotation.State) {
    const result = await runExpertLoop(
        `당신은 한국 농촌 지역 교통 전문가입니다.
출발지에서 숙소까지의 이동 경로, 예상 소요시간, 택시 요금을 안내하세요.
셔틀 서비스 가능 여부도 확인하세요.`,
        state.messages,
        transportTools,
    );
    return {
        collectedData: [{ source: "transport", result }],
        completedExperts: ["transport"],
    };
}

/**
 * Node 4: Korea Travel Expert - food, sights, culture
 */
async function koreaTravelExpertNode(state: typeof StateAnnotation.State) {
    const result = await runExpertLoop(
        `당신은 한국 여행 문화 전문가입니다.
주변 맛집, 관광지, 한국 문화 에티켓을 외국인 게스트가 이해하기 쉽게 안내하세요.
한자어나 고유명사는 쉬운 영어/한국어로 풀어 설명하세요.`,
        state.messages,
        travelTools,
    );
    return {
        collectedData: [{ source: "korea_travel", result }],
        completedExperts: ["korea_travel"],
    };
}

/**
 * Node 5: Synthesizer - merges expert results into a single response
 */
async function synthesizerNode(state: typeof StateAnnotation.State) {
    const dataContext = state.collectedData
        .map(d => `[${d.source}]\n${d.result}`)
        .join("\n\n---\n\n");

    const systemPrompt = new SystemMessage(
        `당신은 Rural Rest AI 컨시어지 - 따뜻하고 박학다식한 시골 친구입니다.
아래의 전문가 분석 결과를 통합하여 게스트에게 하나의 자연스러운 답변을 작성하세요.

규칙:
- 존댓말 사용
- 간결하되 필요한 정보는 빠짐없이 포함
- 모르는 것은 호스트 문의 안내
- 전문가 결과가 여러 개면 논리적 순서로 통합 (예: 교통편 -> 도착 후 맛집)

전문가 분석 결과:
${dataContext}`
    );

    const response = await baseModel.invoke([systemPrompt, ...state.messages]);
    return { messages: [response] };
}

/**
 * Routing: after router -> first activated expert
 */
function routeAfterRouter(state: typeof StateAnnotation.State): string {
    const experts = state.activatedExperts;
    if (experts.includes("app_logic")) return "app_logic";
    if (experts.includes("transport")) return "transport";
    if (experts.includes("korea_travel")) return "korea_travel";
    return "synthesizer";
}

/**
 * Routing: after expert -> next incomplete expert or synthesizer
 */
function routeAfterExpert(state: typeof StateAnnotation.State): string {
    const activated = state.activatedExperts;
    const completed = state.completedExperts;
    const remaining = activated.filter(e => !completed.includes(e));

    if (remaining.length === 0) return "synthesizer";

    if (remaining.includes("app_logic")) return "app_logic";
    if (remaining.includes("transport")) return "transport";
    if (remaining.includes("korea_travel")) return "korea_travel";

    return "synthesizer";
}

/**
 * Build the 5-node graph
 */
const routeTargets = {
    app_logic: "app_logic" as const,
    transport: "transport" as const,
    korea_travel: "korea_travel" as const,
    synthesizer: "synthesizer" as const,
};

const workflow = new StateGraph(StateAnnotation)
    .addNode("router", routerNode)
    .addNode("app_logic", appLogicNode)
    .addNode("transport", transportExpertNode)
    .addNode("korea_travel", koreaTravelExpertNode)
    .addNode("synthesizer", synthesizerNode)
    .addEdge(START, "router")
    .addConditionalEdges("router", routeAfterRouter, routeTargets)
    .addConditionalEdges("app_logic", routeAfterExpert, routeTargets)
    .addConditionalEdges("transport", routeAfterExpert, routeTargets)
    .addConditionalEdges("korea_travel", routeAfterExpert, routeTargets)
    .addEdge("synthesizer", END);

export const conciergeGraph = workflow.compile();

/**
 * Helper to run the concierge (backward-compatible)
 */
export async function runConcierge(threadId: string, messages: BaseMessage[]) {
    const result = await conciergeGraph.invoke(
        { messages },
        { configurable: { thread_id: threadId } }
    );
    return result;
}
