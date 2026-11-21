import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  async redirects() {
    // Arabic is the primary language of the site.
    return [{ source: "/", destination: "/ar", permanent: false }];
  },
};

export default nextConfig;
