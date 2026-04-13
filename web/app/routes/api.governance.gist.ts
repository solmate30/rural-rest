/**
 * GitHub Gist 생성 API
 *
 * 제안 설명 마크다운을 GitHub Gist에 업로드하고 raw URL을 반환.
 * 서버 측 PAT(Personal Access Token)를 사용하므로 사용자는 GitHub 계정 불필요.
 */

export async function action({ request }: { request: Request }) {
    if (request.method !== "POST") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const { requireUser } = await import("../lib/auth.server");
    await requireUser(request);

    const token = process.env.GITHUB_GIST_TOKEN;
    if (!token) {
        return Response.json(
            { error: "Gist 서비스가 설정되지 않았습니다. URL 입력 모드를 사용하세요." },
            { status: 503 }
        );
    }

    let body: { title?: string; content?: string };
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
    }

    const { title, content } = body;

    if (!content || !content.trim()) {
        return Response.json({ error: "제안 내용을 입력하세요." }, { status: 400 });
    }

    if (!title || !title.trim()) {
        return Response.json({ error: "제안 제목을 입력하세요." }, { status: 400 });
    }

    try {
        const res = await fetch("https://api.github.com/gists", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                description: `[Rural Rest DAO] ${title.trim()}`,
                public: true,
                files: {
                    "README.md": {
                        content: content.trim(),
                    },
                },
            }),
        });

        if (!res.ok) {
            const errorData = await res.text();
            console.error("GitHub Gist API error:", res.status, errorData);
            return Response.json(
                { error: "문서 업로드에 실패했습니다. 잠시 후 다시 시도하세요." },
                { status: 502 }
            );
        }

        const data = await res.json();
        const rawUrl = data.files?.["README.md"]?.raw_url;

        if (!rawUrl) {
            return Response.json(
                { error: "Gist 생성은 되었으나 URL을 가져올 수 없습니다." },
                { status: 500 }
            );
        }

        return Response.json({ url: rawUrl });
    } catch (err: any) {
        console.error("Gist creation error:", err);
        return Response.json(
            { error: "네트워크 오류가 발생했습니다." },
            { status: 502 }
        );
    }
}
