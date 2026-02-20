import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/home.tsx"),
    route("auth", "routes/auth.tsx"),
    route("property/:id", "routes/property.tsx"),
    route("book/:id", "routes/book.tsx"),
    route("admin", "routes/admin.dashboard.tsx"),
    route("admin/edit/:id", "routes/admin.edit.tsx"),
    route("auth/*", "routes/auth.$.tsx"),
    route("api/sign-cloudinary", "routes/api.sign-cloudinary.ts"),
    route("api/chat/concierge", "routes/api.chat.concierge.ts"),
    route("search", "routes/search.tsx"),
    route("invest", "routes/invest.tsx"),
    route("invest/:listingId", "routes/invest.detail.tsx"),
] satisfies RouteConfig;
