/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "i.ebayimg.com",
      },
      {
        protocol: "https",
        hostname: "**.etsystatic.com",
      },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ["playwright", "@prisma/client"],
  },
};

export default nextConfig;
