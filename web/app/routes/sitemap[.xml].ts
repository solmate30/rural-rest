import { db } from "~/db/index.server";
import { listings } from "~/db/schema";

const BASE_URL = "https://rural-rest.vercel.app";

export async function loader() {
    const rows = await db.select({ id: listings.id }).from(listings);

    const staticUrls = [
        { loc: BASE_URL, priority: "1.0", changefreq: "daily" },
        { loc: `${BASE_URL}/invest`, priority: "0.8", changefreq: "weekly" },
        { loc: `${BASE_URL}/search`, priority: "0.7", changefreq: "daily" },
    ];

    const propertyUrls = rows.map((row) => ({
        loc: `${BASE_URL}/property/${row.id}`,
        priority: "0.9",
        changefreq: "weekly",
    }));

    const allUrls = [...staticUrls, ...propertyUrls];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls
    .map(
        (u) => `  <url>
    <loc>${u.loc}</loc>
    <priority>${u.priority}</priority>
    <changefreq>${u.changefreq}</changefreq>
  </url>`
    )
    .join("\n")}
</urlset>`;

    return new Response(xml, {
        headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
        },
    });
}
