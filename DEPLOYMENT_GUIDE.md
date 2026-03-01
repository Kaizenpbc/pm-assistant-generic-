# PM Application - Deployment Guide

## 🚀 Deployment Flexibility

The PM Application is designed to work seamlessly in various deployment scenarios:

### ✅ Supported Deployment Configurations

1. **Domain Root Deployment**
   ```
   https://example.com/
   https://pm-app.com/
   ```

2. **Subdirectory Deployment**
   ```
   https://example.com/pm-assistant/
   https://company.com/apps/pm/
   ```

3. **Subdomain Deployment**
   ```
   https://pm.example.com/
   https://app.company.com/
   ```

## 🔧 Dynamic Path Resolution

### How It Works

The application automatically detects its deployment path and adjusts all asset references accordingly:

- **Service Worker**: `/sw.js` → `/pm-assistant/sw.js`
- **Manifest**: `/manifest.json` → `/pm-assistant/manifest.json`
- **Icons**: `/icon-192x192.png` → `/pm-assistant/icon-192x192.png`
- **Notifications**: Dynamic icon paths in browser notifications

### Implementation Details

#### 1. Path Service (`src/services/pathService.ts`)
```typescript
// Automatically detects deployment path
const basePath = pathService.getCurrentBasePath();

// Resolves paths dynamically
const swPath = pathService.getServiceWorkerPath();
const iconPath = pathService.getIconPath('192x192');
```

#### 2. Service Worker (`public/sw.js`)
```javascript
// Uses registration scope to determine base path
const BASE_PATH = getBasePath();
const STATIC_FILES = [
  BASE_PATH + 'dashboard',
  BASE_PATH + 'manifest.json',
  // ... other files
];
```

#### 3. HTML Assets (`index.html`)
```html
<!-- Uses relative paths that work in any deployment -->
<link rel="manifest" href="./manifest.json" />
<link rel="icon" href="./icon-192x192.png" />
```

## 📁 Deployment Steps

### 1. Build the Application
```bash
cd src/client
npm run build
```

### 2. Deploy to Your Server

#### Option A: Domain Root
```bash
# Copy dist folder contents to web root
cp -r dist/* /var/www/html/
```

#### Option B: Subdirectory
```bash
# Copy dist folder contents to subdirectory
cp -r dist/* /var/www/html/pm-assistant/
```

#### Option C: Subdomain
```bash
# Copy dist folder contents to subdomain root
cp -r dist/* /var/www/html/pm-subdomain/
```

### 3. Configure Web Server

#### Nginx Configuration
```nginx
# For subdirectory deployment
location /pm-assistant/ {
    try_files $uri $uri/ /pm-assistant/index.html;
    
    # PWA headers
    add_header Cache-Control "public, max-age=31536000" for static assets;
    add_header Service-Worker-Allowed "/pm-assistant/";
}
```

#### Apache Configuration
```apache
# For subdirectory deployment
<Directory "/var/www/html/pm-assistant">
    RewriteEngine On
    RewriteBase /pm-assistant/
    RewriteRule ^index\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /pm-assistant/index.html [L]
</Directory>
```

## 🔍 Debugging Deployment Issues

### Check Deployment Information
The application logs deployment information to the console:

```javascript
// Console output example:
🚀 PM Application Deployment Info: {
  isDev: false,
  isProd: true,
  basePath: "/pm-assistant/",
  deploymentInfo: {
    basePath: "/pm-assistant/",
    isSubdirectory: true,
    currentUrl: "https://example.com/pm-assistant/",
    pathname: "/pm-assistant/"
  }
}
```

### Common Issues and Solutions

#### 1. Service Worker Not Registering
- **Issue**: 404 errors for `/sw.js`
- **Solution**: Ensure `sw.js` is accessible at the correct path
- **Check**: Browser Network tab for failed requests

#### 2. Manifest Not Loading
- **Issue**: PWA features not working
- **Solution**: Verify `manifest.json` is accessible
- **Check**: Application tab in DevTools

#### 3. Icons Not Displaying
- **Issue**: Broken icon references in notifications
- **Solution**: Ensure all icon files are in the correct directory
- **Check**: Icon paths in browser notifications

## 🧪 Testing Different Deployment Scenarios

### Local Testing
```bash
# Test subdirectory deployment locally
cd src/client
npm run build
cd dist
python -m http.server 8080
# Access at http://localhost:8080/pm-assistant/
```

### Production Testing
1. Deploy to test environment
2. Check browser console for deployment info
3. Verify PWA features work correctly
4. Test offline functionality
5. Check notification icons

## 📋 Deployment Checklist

- [ ] Build application successfully
- [ ] Copy files to correct server location
- [ ] Configure web server routing
- [ ] Test service worker registration
- [ ] Verify manifest.json accessibility
- [ ] Check icon paths in notifications
- [ ] Test PWA installation
- [ ] Verify offline functionality
- [ ] Check deployment info in console
- [ ] Test all routes work correctly

## 🔗 Related Files

- `src/services/pathService.ts` - Dynamic path resolution
- `src/utils/buildUtils.ts` - Build-time path utilities
- `src/services/pwaService.ts` - PWA service with dynamic paths
- `public/sw.js` - Service worker with dynamic caching
- `public/manifest.json` - PWA manifest with relative paths
- `index.html` - HTML with relative asset paths

## 💡 Best Practices

1. **Always use relative paths** for static assets
2. **Test deployment** in the target environment
3. **Monitor console logs** for deployment info
4. **Verify PWA features** work in production
5. **Use HTTPS** for PWA functionality
6. **Set proper cache headers** for static assets
