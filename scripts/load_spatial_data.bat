@echo off
REM PropertyIQ POC: Load spatial data into PostGIS using ogr2ogr
REM
REM Prerequisites:
REM   - PostgreSQL + PostGIS installed and database created
REM   - GDAL/ogr2ogr installed (comes with PostGIS Stack Builder or OSGeo4W)
REM   - Data files downloaded into the data/ folders
REM
REM Usage: Run from the propertyiq-poc directory
REM   scripts\load_spatial_data.bat

SET DB=PG:"dbname=propertyiq user=postgres password=postgres host=localhost"
SET DATA_DIR=%~dp0..\data

echo ============================================
echo PropertyIQ POC: Loading Spatial Data
echo ============================================

REM --- Meshblock Boundaries ---
echo.
echo [1/4] Loading meshblock boundaries...
IF EXIST "%DATA_DIR%\nzdep\meshblock-2023-generalised.gpkg" (
    ogr2ogr -f "PostgreSQL" %DB% "%DATA_DIR%\nzdep\meshblock-2023-generalised.gpkg" -t_srs EPSG:4326 -nln meshblocks -overwrite
    echo       Meshblocks loaded successfully
) ELSE IF EXIST "%DATA_DIR%\nzdep\meshblock-2023-generalised.shp" (
    ogr2ogr -f "PostgreSQL" %DB% "%DATA_DIR%\nzdep\meshblock-2023-generalised.shp" -t_srs EPSG:4326 -nln meshblocks -overwrite
    echo       Meshblocks loaded successfully
) ELSE (
    echo       ERROR: Meshblock file not found in %DATA_DIR%\nzdep\
    echo       Download from: https://datafinder.stats.govt.nz/layer/111228-meshblock-2023-generalised/
)

REM --- LINZ Parcels ---
echo.
echo [2/4] Loading LINZ parcels...
IF EXIST "%DATA_DIR%\linz\nz-parcels.gpkg" (
    ogr2ogr -f "PostgreSQL" %DB% "%DATA_DIR%\linz\nz-parcels.gpkg" -t_srs EPSG:4326 -nln parcels -overwrite
    echo       Parcels loaded successfully
) ELSE (
    echo       WARNING: LINZ parcels file not found in %DATA_DIR%\linz\
    echo       Download from: https://data.linz.govt.nz (Layer 51571)
)

REM --- LINZ Addresses ---
echo.
echo [3/4] Loading LINZ addresses...
IF EXIST "%DATA_DIR%\linz\nz-street-address.gpkg" (
    ogr2ogr -f "PostgreSQL" %DB% "%DATA_DIR%\linz\nz-street-address.gpkg" -t_srs EPSG:4326 -nln addresses -overwrite
    echo       Addresses loaded successfully
) ELSE (
    echo       WARNING: LINZ address file not found in %DATA_DIR%\linz\
    echo       Download from: https://data.linz.govt.nz (Layer 53353)
)

REM --- Flood Zones ---
echo.
echo [4/4] Loading flood zones...
IF EXIST "%DATA_DIR%\flood\wellington-flood-zones.gpkg" (
    ogr2ogr -f "PostgreSQL" %DB% "%DATA_DIR%\flood\wellington-flood-zones.gpkg" -t_srs EPSG:4326 -nln flood_zones -overwrite
    echo       Flood zones loaded successfully
) ELSE IF EXIST "%DATA_DIR%\flood\*.shp" (
    for %%f in ("%DATA_DIR%\flood\*.shp") do (
        ogr2ogr -f "PostgreSQL" %DB% "%%f" -t_srs EPSG:4326 -nln flood_zones -overwrite
        echo       Flood zones loaded from %%f
    )
) ELSE (
    echo       WARNING: Flood zone file not found in %DATA_DIR%\flood\
    echo       Download from: https://mapping.gw.govt.nz or https://koordinates.com
)

echo.
echo ============================================
echo Data loading complete!
echo.
echo Next steps:
echo   1. Run: psql -U postgres -d propertyiq -f sql\03-create-indexes-views.sql
echo   2. Run the validation query in sql\04-validation-query.sql
echo ============================================
