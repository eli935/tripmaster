@echo off
echo ========================================
echo   TripMaster - Setup
echo ========================================
echo.
echo Installing dependencies...
call npm install
echo.
echo Done! Now:
echo   1. Create a Supabase project at https://supabase.com
echo   2. Run the SQL from supabase/migrations/001_initial_schema.sql
echo   3. Update .env.local with your Supabase URL and Key
echo   4. Run: npm run dev
echo   5. Open: http://localhost:3000
echo.
pause
