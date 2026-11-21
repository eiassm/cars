import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  async redirects() {
    // Arabic is the primary language of the site.
    return [
      { source: "/", destination: "/ar", permanent: false },
      // The gold 3D plan was retired; the interactive plan lives at /[lang]/ev.
      { source: "/:lang(ar|en)/floor-plan", destination: "/:lang/ev", permanent: true },
    ];
  },
};

export default nextConfig;
