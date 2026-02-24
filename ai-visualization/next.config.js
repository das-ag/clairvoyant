/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        formats: ['image/webp'],
    },
    experimental: {
        outputFileTracingIncludes: {
            '/api/**': ['./data/problems/**'],
        },
    },
}

module.exports = nextConfig
