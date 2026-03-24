import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/home.tsx"),
    route("auth", "routes/auth.tsx"),
    route("property/:id", "routes/property.tsx"),
    route("book/:id", "routes/book.tsx"),
    route("host", "routes/host.dashboard.tsx"),
    route("host/edit/:id", "routes/admin.edit.tsx"),
    route("host/tokenize/:listingId", "routes/admin.tokenize.tsx"),
    route("admin", "routes/admin.dashboard.tsx"),
    route("auth/*", "routes/auth.$.tsx"),
    route("api/sign-cloudinary", "routes/api.sign-cloudinary.ts"),
    route("api/rwa/save-mint", "routes/api.rwa.save-mint.ts"),
    route("api/rwa/record-purchase", "routes/api.rwa.record-purchase.ts"),
    route("api/chat/concierge", "routes/api.chat.concierge.ts"),
    route("search", "routes/search.tsx"),
    route("invest", "routes/invest.tsx"),
    route("invest/:listingId", "routes/invest.detail.tsx"),
    route("my-investments", "routes/my-investments.tsx"),
    route("kyc", "routes/kyc.tsx"),

] satisfies RouteConfig;
