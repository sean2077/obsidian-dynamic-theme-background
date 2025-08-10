#!/bin/bash

# Cloudflare Pages 部署配置脚本
# 使用方法: ./update-domain.sh your-actual-domain.com

if [ $# -eq 0 ]; then
    echo "使用方法: $0 <domain>"
    echo "示例: $0 dtb-plugin.pages.dev"
    echo "或者: $0 your-custom-domain.com"
    exit 1
fi

DOMAIN=$1
OLD_PLACEHOLDER="YOUR-DOMAIN-HERE"

echo "🔄 正在将域名占位符替换为: $DOMAIN"

# 替换 HTML 文件中的域名 (只替换 canonical 和 og:url，保留相对路径的导航链接)
sed -i "s|https://$OLD_PLACEHOLDER|https://$DOMAIN|g" index.html
sed -i "s|https://$OLD_PLACEHOLDER|https://$DOMAIN|g" index.zh.html

# 替换 sitemap.xml 中的域名
sed -i "s|https://$OLD_PLACEHOLDER|https://$DOMAIN|g" sitemap.xml

# 替换 robots.txt 中的域名
sed -i "s|https://$OLD_PLACEHOLDER|https://$DOMAIN|g" robots.txt

echo "✅ 域名替换完成!"
echo "📝 已更新以下内容:"
echo "   - canonical URLs"
echo "   - Open Graph URLs"  
echo "   - sitemap.xml"
echo "   - robots.txt"
echo "   ℹ️  语言切换链接保持相对路径 (index.html ↔ index.zh.html)"
echo ""
echo "🚀 现在您可以部署到 Cloudflare Pages 了！"
