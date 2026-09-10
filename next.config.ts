import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  // Next blocks its dev-only resources (HMR, client bootstrap) for any origin it
  // does not consider canonical, which silently leaves the page stuck on the
  // server-rendered markup when the app is opened on 127.0.0.1 instead of
  // localhost. Both spellings point at this machine, so allow both.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
}

export default nextConfig
