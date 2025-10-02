#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const { minify } = require('terser');
const { minify: minifyHtml } = require('html-minifier-terser');
const { sync: globSync } = require('glob');
const { bundle, Features } = require('lightningcss');

// Define paths
const publicDir = path.join(__dirname, 'public');
const distDir = path.join(__dirname, 'dist');

async function build() {
    console.log('🔧 Starting production build...');

    try {
        // 1. Clean and recreate the dist directory
        console.log(`🧹 Cleaning directory: ${distDir}`);
        fs.emptyDirSync(distDir);

        // 2. Copy all files from public to dist
        console.log(`📂 Copying files from "${publicDir}" to "${distDir}"...`);
        fs.copySync(publicDir, distDir);
        console.log('✅ Files copied successfully.');

        // 3. Process JavaScript files
        console.log('⚡ Processing JavaScript files...');
        const jsFiles = globSync('**/*.js', { cwd: distDir, absolute: true });

        for (const filePath of jsFiles) {
            console.log(`   - Processing ${path.basename(filePath)}`);
            let content = fs.readFileSync(filePath, 'utf8');

            // Skip minification for empty or whitespace-only files
            if (!content.trim()) {
                console.log(`   - Skipping empty file: ${path.basename(filePath)}`);
                continue; // Move to the next file
            }

            // Replace environment variables like the original script did
            content = content.replace(/process\.env\.NODE_ENV !== 'production'/g, 'false');

            // Minify the JS code
            const result = await minify(content, {
                mangle: {
                    toplevel: false, // DO NOT mangle top-level names to avoid conflicts
                },
                compress: {
                    drop_console: true, // Remove console.log etc.
                },
            });

            if (result.code) {
                fs.writeFileSync(filePath, result.code);
            } else {
                throw new Error(`Terser failed to minify ${path.basename(filePath)}`);
            }
        }
        console.log('✅ JavaScript processing complete.');

        // 4. Process and bundle CSS files with LightningCSS
        console.log('🎨 Processing CSS files with LightningCSS...');
        const cssFiles = globSync('**/*.css', { cwd: distDir, absolute: true });

        for (const filePath of cssFiles) {
            console.log(`   - Processing ${path.basename(filePath)}`);
            let fileBuffer = fs.readFileSync(filePath);
            
            let { code } = bundle({
                filename: filePath,
                content: fileBuffer,
                minify: true,
                // Enable modern CSS features and vendor prefixing for older browsers
                drafts: {
                    nesting: true,
                    customMedia: true
                },
                // Target browserslist defaults for prefixing
                targets: {
                    // Add prefixes for browsers with >0.5% market share
                    "android": 97,
                    "chrome": 97,
                    "edge": 97,
                    "firefox": 96,
                    "ie": 11,
                    "ios": 15,
                    "opera": 82,
                    "safari": 15
                }
            });
            fs.writeFileSync(filePath, code);
        }
        console.log('✅ CSS processing complete.');

        // 5. Process HTML files
        console.log('📄 Processing HTML files...');
        const htmlFiles = globSync('**/*.html', { cwd: distDir, absolute: true });

        for (const filePath of htmlFiles) {
            console.log(`   - Minifying ${path.basename(filePath)}`);
            const content = fs.readFileSync(filePath, 'utf8');

            const minifiedContent = await minifyHtml(content, {
                collapseWhitespace: true,
                removeComments: true,
                minifyCSS: true, // This minifies inline CSS
                minifyJS: true, 
                removeAttributeQuotes: false, // Disabled for safety
            });

            fs.writeFileSync(filePath, minifiedContent);
        }
        console.log('✅ HTML processing complete.');

        console.log(`
🎉 Production build completed successfully!`);
        console.log(`🚀 Your production-ready files are in the "${path.basename(distDir)}" directory.`);

    } catch (error) {
        console.error('❌ Build failed:', error);
        process.exit(1);
    }
}

build();
