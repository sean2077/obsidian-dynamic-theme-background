@echo off
REM Cloudflare Pages 部署配置脚本 (Windows 版本)
REM 使用方法: update-domain.bat your-actual-domain.com

if "%1"=="" (
    echo 使用方法: %0 ^<domain^>
    echo 示例: %0 dtb-plugin.pages.dev
    echo 或者: %0 your-custom-domain.com
    exit /b 1
)

set DOMAIN=%1
set OLD_PLACEHOLDER=YOUR-DOMAIN-HERE

echo 🔄 正在将域名占位符替换为: %DOMAIN%

REM 使用 PowerShell 进行文本替换 (只替换 canonical 和 og:url，保留相对路径的导航链接)
powershell -Command "(Get-Content index.html) -replace 'https://%OLD_PLACEHOLDER%', 'https://%DOMAIN%' | Set-Content index.html"
powershell -Command "(Get-Content index.zh.html) -replace 'https://%OLD_PLACEHOLDER%', 'https://%DOMAIN%' | Set-Content index.zh.html"
powershell -Command "(Get-Content sitemap.xml) -replace 'https://%OLD_PLACEHOLDER%', 'https://%DOMAIN%' | Set-Content sitemap.xml"
powershell -Command "(Get-Content robots.txt) -replace 'https://%OLD_PLACEHOLDER%', 'https://%DOMAIN%' | Set-Content robots.txt"

echo ✅ 域名替换完成!
echo 📝 已更新以下内容:
echo    - canonical URLs
echo    - Open Graph URLs
echo    - sitemap.xml
echo    - robots.txt
echo    ℹ️  语言切换链接保持相对路径 (index.html ↔ index.zh.html)
echo.
echo 🚀 现在您可以部署到 Cloudflare Pages 了！
pause
