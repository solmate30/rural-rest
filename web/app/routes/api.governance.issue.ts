/**
 * GitHub Issue 생성 API
 *
 * 제안 설명 마크다운을 지정 레포의 GitHub Issue로 등록하고 Issue URL을 반환.
 * 서버 측 PAT(Personal Access Token)를 사용하므로 사용자는 GitHub 계정 불필요.
 *
 * 환경변수:
 *   GITHUB_TOKEN        -- GitHub PAT (repo scope 필요)
 *   GITHUB_DAO_REPO     -- "owner/repo" 형식 (예: "rural-rest/dao-proposals")
 */

const CATEGORY_LABELS: Record<string, string> = {
    operations: "운영",
    guidelines: "가이드라인",
    fundUsage: "자금 사용",
    other: "기타",
};

export async function action({ request }: { request: Request }) {
    if (request.method !== "POST") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const token = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_DAO_REPO;

    if (!token || !repo) {
        return Response.json(
            { error: "GitHub Issue 서비스가 설정되지 않았습니다. URL 입력 모드를 사용하세요." },
            { status: 503 }
        );
    }

    let body: { title?: string; content?: string; category?: string };
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
    }

    const { title, content, category } = body;

    if (!title || !title.trim()) {
        return Response.json({ error: "제안 제목을 입력하세요." }, { status: 400 });
    }

    if (!content || !content.trim()) {
        return Response.json({ error: "제안 내용을 입력하세요." }, { status: 400 });
    }

    // 카테고리 라벨
    const categoryLabel = category ? CATEGORY_LABELS[category] || category : undefined;
    const labels = ["dao-proposal"];
    if (categoryLabel) labels.push(categoryLabel);

    try {
        const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                title: `[DAO] ${title.trim()}`,
                body: content.trim(),
                labels,
            }),
        });

        if (!res.ok) {
            const errorData = await res.text();
            console.error("GitHub Issues API error:", res.status, errorData);
            return Response.json(
                { error: "Issue 등록에 실패했습니다. 잠시 후 다시 시도하세요." },
                { status: 502 }
            );
        }

        const data = await res.json();
        const issueUrl = data.html_url; // https://github.com/owner/repo/issues/123

        if (!issueUrl) {
            return Response.json(
                { error: "Issue 생성은 되었으나 URL을 가져올 수 없습니다." },
                { status: 500 }
            );
        }

        return Response.json({ url: issueUrl, issueNumber: data.number });
    } catch (err: any) {
        console.error("GitHub Issue creation error:", err);
        return Response.json(
            { error: "네트워크 오류가 발생했습니다." },
            { status: 502 }
        );
    }
}
