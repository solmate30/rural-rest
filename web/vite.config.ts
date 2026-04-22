import { reactRouter } from "@react-router/dev/vite";

import { defineConfig, loadEnv, createLogger } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const logger = createLogger();
const _warn = logger.warn.bind(logger);
logger.warn = (msg, opts) => {
  if (msg.includes("Sourcemap for") && msg.includes("points to missing source files")) return;
  _warn(msg, opts);
};

export default defineConfig(({ mode }) => {
  // VITE_ 접두사 없는 서버 전용 시크릿도 SSR process.env에서 읽히도록 주입
  const env = loadEnv(mode, process.cwd(), "");
  Object.assign(process.env, env);

  return {
    customLogger: logger,
    plugins: [reactRouter(), tsconfigPaths()],
    resolve: {
      dedupe: ["react", "react-dom"],
    },
    ssr: {
      noExternal: ["better-auth", "tailwind-merge", "clsx", "@privy-io/react-auth", "@privy-io/js-sdk-core"],
    },
  };
});