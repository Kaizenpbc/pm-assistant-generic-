# 🛠️ PM Application v2 - Troubleshooting Guide

## 🚨 Quick Recovery

**If the system is completely broken:**
```bash
# Linux/Mac
./scripts/recovery.sh

# Windows
scripts\recovery.bat
```

## 🔍 Common Issues & Solutions

### 1. Server Won't Start

#### **Issue:** "Database connection failed"
```bash
# Check if MySQL is running
docker ps | grep mysql

# Start MySQL
npm run docker:mysql

# Or with Docker Compose
docker-compose up -d mysql
```

#### **Issue:** "Configuration validation failed"
```bash
# Validate configuration
npm run config:validate

# Generate new secrets if needed
npm run config:generate-secrets

# Generate complete .env file
npm run config:generate-env
```

#### **Issue:** "Port already in use"
```bash
# Check what's using the port
netstat -tulpn | grep :3001
netstat -tulpn | grep :5173

# Kill processes using ports
# Linux/Mac
lsof -ti:3001 | xargs kill -9
lsof -ti:5173 | xargs kill -9

# Windows
netstat -ano | findstr :3001
taskkill /F /PID <PID_NUMBER>
```

### 2. Frontend Issues

#### **Issue:** "Failed to connect to localhost:3001"
```bash
# Check backend is running
curl http://localhost:3001/health/basic

# Check API configuration
grep -r "localhost:3002" src/client/src/
# Should be localhost:3001, not 3002
```

#### **Issue:** "Module not found" or corrupted node_modules
```bash
# Clean and reinstall
cd src/client
rm -rf node_modules package-lock.json
npm install
cd ../..
```

#### **Issue:** "Vite build errors"
```bash
# Check Vite configuration
cat src/client/vite.config.ts

# Clear Vite cache
rm -rf src/client/.vite
rm -rf src/client/dist
```

### 3. Database Issues

#### **Issue:** "MySQL connection refused"
```bash
# Check Docker containers
docker ps -a

# Restart MySQL container
docker-compose restart mysql

# Check MySQL logs
docker-compose logs mysql

# Reset MySQL data (WARNING: deletes all data)
docker-compose down -v
docker-compose up -d mysql
```

#### **Issue:** "Database not found"
```bash
# Check if database exists
docker exec -it pm-application-mysql mysql -u root -prootpassword -e "SHOW DATABASES;"

# Create database if missing
docker exec -it pm-application-mysql mysql -u root -prootpassword -e "CREATE DATABASE IF NOT EXISTS pm_application_v2;"
```

### 4. Authentication Issues

#### **Issue:** "Login failed" with correct credentials
```bash
# Check user exists in database
docker exec -it pm-application-mysql mysql -u root -prootpassword -e "USE pm_application_v2; SELECT * FROM users;"

# Default credentials should be: test/password
```

#### **Issue:** "JWT token errors"
```bash
# Check JWT secrets are set
grep JWT_SECRET .env

# Regenerate secrets if needed
npm run config:generate-secrets
```

### 5. Docker Issues

#### **Issue:** "Docker not running"
```bash
# Start Docker service
# Linux
sudo systemctl start docker

# Windows/Mac
# Start Docker Desktop application
```

#### **Issue:** "Port conflicts with existing containers"
```bash
# List all containers
docker ps -a

# Stop conflicting containers
docker stop <container_name>
docker rm <container_name>

# Or stop all PM application containers
docker-compose down
```

### 6. Environment Issues

#### **Issue:** "Environment variables not loaded"
```bash
# Check .env file exists and is readable
ls -la .env
cat .env

# Validate environment
npm run config:validate

# Check if .env is in .gitignore
grep -q "\.env" .gitignore && echo "✅ .env in .gitignore" || echo "❌ .env not in .gitignore"
```

#### **Issue:** "Wrong Node.js version"
```bash
# Check Node.js version
node --version

# Should be 18+ for best compatibility
# Use nvm to manage Node.js versions
nvm install 18
nvm use 18
```

## 🔧 Diagnostic Commands

### Health Check Commands
```bash
# Quick health check
npm run health:script

# Detailed health check
npm run health:detailed

# Check all endpoints
npm run health:all

# Monitor continuously
npm run health:monitor
```

### Configuration Commands
```bash
# Validate configuration
npm run config:validate

# Generate secure secrets
npm run config:generate-secrets

# Generate complete .env file
npm run config:generate-env

# Quick config check
npm run config:check
```

### Testing Commands
```bash
# Run system connectivity tests
npm run test:system

# Run specific test categories
npm run test:connectivity        # Health endpoints & connectivity
npm run test:health-scripts      # Health check script tests
npm run test:config-validation   # Configuration validation tests

# Run all tests
npm run test:all

# Run with coverage
npm run test:coverage
```

### Docker Commands
```bash
# Start all services with Docker
npm run docker:dev

# Start only MySQL
npm run docker:mysql

# View logs
npm run docker:logs

# Stop all services
npm run docker:stop

# Clean everything (removes data!)
npm run docker:clean
```

### Database Commands
```bash
# Connect to MySQL
docker exec -it pm-application-mysql mysql -u root -prootpassword

# List databases
docker exec -it pm-application-mysql mysql -u root -prootpassword -e "SHOW DATABASES;"

# Check users table
docker exec -it pm-application-mysql mysql -u root -prootpassword -e "USE pm_application_v2; SELECT * FROM users;"

# Reset database (WARNING: deletes all data)
docker-compose down -v && docker-compose up -d mysql
```

## 📊 Performance Issues

### **Issue:** Slow startup
```bash
# Check system resources
npm run health:detailed

# Check memory usage
npm run health:script

# Clear caches
npm run docker:clean
rm -rf node_modules src/client/node_modules
npm install && cd src/client && npm install
```

### **Issue:** High memory usage
```bash
# Check memory usage
curl http://localhost:3001/health/detailed | jq '.services.memory'

# Restart services
npm run docker:stop
npm run docker:dev
```

## 🚀 Recovery Procedures

### Complete System Reset
```bash
# Stop everything
npm run docker:stop
taskkill /F /IM node.exe  # Windows
pkill -f node            # Linux/Mac

# Clean everything
rm -rf node_modules src/client/node_modules dist src/client/dist

# Regenerate configuration
npm run config:generate-env

# Reinstall everything
npm install
cd src/client && npm install && cd ../..

# Start fresh
npm run docker:dev
```

### Partial Recovery (Keep Data)
```bash
# Stop services
npm run docker:stop

# Clean only build artifacts
rm -rf dist src/client/dist

# Restart services
npm run docker:dev
```

## 📞 Getting Help

### 1. Check System Health
```bash
npm run health:script:verbose
```

### 2. Validate Configuration
```bash
npm run config:validate
```

### 3. Check Logs
```bash
# Backend logs
npm run docker:logs

# Or check individual service logs
docker-compose logs backend
docker-compose logs frontend
docker-compose logs mysql
```

### 4. Document the Issue
When reporting issues, include:
- Output from `npm run health:script:verbose`
- Output from `npm run config:validate`
- Error messages and stack traces
- Operating system and Node.js version
- Steps to reproduce the issue

## 🔄 Maintenance

### Daily Checks
```bash
# Quick health check
npm run health:script
```

### Weekly Maintenance
```bash
# Update dependencies
npm update
cd src/client && npm update && cd ../..

# Clean old Docker images
docker system prune -f

# Check for security updates
npm audit
cd src/client && npm audit && cd ../..
```

### Monthly Maintenance
```bash
# Rotate secrets (production only)
npm run config:generate-secrets

# Backup database
docker exec pm-application-mysql mysqldump -u root -prootpassword pm_application_v2 > backup.sql

# Clean all build artifacts
npm run docker:clean
```

## 🎯 Success Indicators

Your system is healthy when:
- ✅ `npm run health:script` shows "Overall Status: HEALTHY"
- ✅ `npm run config:validate` shows "Overall Status: HEALTHY"
- ✅ Frontend loads at http://localhost:5173
- ✅ Backend responds at http://localhost:3001/health/basic
- ✅ Database connection successful
- ✅ Login works with test/password

**If all indicators are green, your system is running perfectly!** 🎉
