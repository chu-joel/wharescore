# Rural NZ Council GIS Endpoints — Research Session 67

**Date:** 2026-03-26
**Purpose:** Fill remaining hazard data gaps for rural/regional councils

---

## 1. Northland Regional Council (covers Kaipara DC, Far North DC)

### River Flood Hazard Zones (FeatureServer)
- **100yr CC:** `https://services2.arcgis.com/J8errK5dyxu7Xjf7/arcgis/rest/services/Northland_RFHZ_100yearCC_Extents/FeatureServer`
- **50yr:** `https://services2.arcgis.com/J8errK5dyxu7Xjf7/arcgis/rest/services/Northland_RFHZ_50year_Extents/FeatureServer`
- **10yr:** `https://services2.arcgis.com/J8errK5dyxu7Xjf7/arcgis/rest/services/Northland_RFHZ_10year_Extents/FeatureServer`

### Coastal Flood Hazard Zones
- `https://services2.arcgis.com/J8errK5dyxu7Xjf7/arcgis/rest/services/Northland_Coastal_Flood_Hazard_Zones/FeatureServer`

### Coastal Erosion Hazard Zones
- `https://services2.arcgis.com/J8errK5dyxu7Xjf7/arcgis/rest/services/Coastal_Erosion_Hazard_Zones/FeatureServer`

### Land Hazards (NRC MapServer)
- `https://nrcmaps.nrc.govt.nz/imagery/rest/services/Land_Hazards/MapServer`
  - Layer 0: Flood Susceptible Land
  - Layer 1: Erosion Prone Land

### Erosion Prone Land
- `https://services2.arcgis.com/J8errK5dyxu7Xjf7/arcgis/rest/services/Erosion_Prone_Land/FeatureServer`

### Ruawai Modelled Flood Hazards (Kaipara lowlands)
- `https://nrcmaps.nrc.govt.nz/imagery/rest/services/Ruawai_Modelled_Flood_Hazards/MapServer`
  - Layers 1-3: River Flood 10yr/50yr/100yr CC
  - Layers 10-13: Coastal Flood Hazard Zones 0-3

---

## 2. Waikato Regional Council (covers South Waikato, Matamata-Piako, Hauraki, Waipa)

### Regional Flood Hazard
- `https://services.arcgis.com/2bzQ0Ix3iO7MItUa/arcgis/rest/services/Regional_Flood_Hazard_Update/FeatureServer`

### Local-Scale Flood Modelling
- **Depth:** `https://services.arcgis.com/2bzQ0Ix3iO7MItUa/arcgis/rest/services/HAZ_MOD_LOCAL_FLOOD_DEPTH/FeatureServer`
- **Hazard Classification:** `https://services.arcgis.com/2bzQ0Ix3iO7MItUa/arcgis/rest/services/HAZ_MOD_LOCAL_FLOOD_HAZ_CLASS/FeatureServer`

### Flood Extent 1% AEP (Lower Waikato & Waipa Rivers)
- `https://services.arcgis.com/2bzQ0Ix3iO7MItUa/arcgis/rest/services/HAZ_FLOOD_EXTENT_1_AEP_OCT_2021/FeatureServer`

### Waipa District Flood Hazard
- `https://services9.arcgis.com/OsxSXqmTWVTZQ9ie/arcgis/rest/services/WaipaDistrictPlan_SpecialFeature_Area_Flood/FeatureServer`
- **Climate Change:** `https://services9.arcgis.com/OsxSXqmTWVTZQ9ie/arcgis/rest/services/Stormwater_Modelling_2019_Extent_Climate_Change/FeatureServer`

---

## 3. Bay of Plenty Regional (covers Opotiki, Whakatane)

### Natural Hazards MapServer
- `https://gis.boprc.govt.nz/server2/rest/services/BayOfPlentyMaps/Natural_Hazards/MapServer`
  - Layer 8: Flooding (region-wide)
  - Layer 5: Historic Flood Extents

---

## 4. Hawke's Bay Regional Council (covers Central HB, Wairoa, Hastings, Napier)

### Combined Property Hazards (best single endpoint)
- `https://gis.hbrc.govt.nz/server/rest/services/HazardPortal/HBRC_Property_Hazards/MapServer`
  - Layer 24: Flood Risk Areas (region-wide)
  - Layer 22: Hastings ponding
  - Layers 3-7: Landslide Risk (5 categories)
  - Layer 20: CHB/HDC/WDC Liquefaction Severity
  - Layer 21: Earthquake Amplification
  - Layers 25-26: Wairoa River Bank Stability
  - Layers 29-40: Coastal Erosion (Present/2065/2120)
  - Layer 62: Tsunami Near Source
  - Layers 54-61: Contaminated Sites

### Standalone Services
- **Flooding:** `https://gis.hbrc.govt.nz/server/rest/services/HazardPortal/Flooding/MapServer` (Layer 0: Flood Risk Areas)
- **Landslide:** `https://gis.hbrc.govt.nz/server/rest/services/HazardPortal/Landslide_Risk/MapServer` (Layers 1-5)
- **Liquefaction:** `https://gis.hbrc.govt.nz/server/rest/services/HazardPortal/Earthquake_Liquefaction/MapServer`
- **Amplification:** `https://gis.hbrc.govt.nz/server/rest/services/HazardPortal/Earthquake_Amplification/MapServer`
- **Tsunami:** `https://gis.hbrc.govt.nz/server/rest/services/HazardPortal/Tsunami_Inundation/MapServer`
- **Coastal Erosion:** `https://gis.hbrc.govt.nz/server/rest/services/HazardPortal/Present_Day_Coastal_Erosion/MapServer`
- **Coastal Inundation 2023:** `https://gis.hbrc.govt.nz/server/rest/services/HazardPortal/Coastal_Inundation_2023/MapServer`
- **Wairoa River Bank:** `https://gis.hbrc.govt.nz/server/rest/services/HazardPortal/Wairoa_River_Bank/MapServer`

### Tsunami Evacuation 2024
- `https://services1.arcgis.com/hWByVnSkh6ElzHkf/arcgis/rest/services/HawkesBay_Tsunami_Evacuation_Zones_2024/FeatureServer`

---

## 5. Horizons Regional Council (Manawatu-Wanganui)

### 200yr Flood Model
- `https://services1.arcgis.com/VuN78wcRdq1Oj69W/arcgis/rest/services/Modelled_wet_extents_data_from_flood_plain_mapping_analysis/FeatureServer`
  - Layer 11: Flood Hazard 200yr Modelled Wet Extent

### Observed Flooding Extents
- `https://services1.arcgis.com/VuN78wcRdq1Oj69W/arcgis/rest/services/NaturalHazards_ObservedFloodingExtent/FeatureServer`
  - Layer 21: Indicative Flooding Extents

### Floodways (OnePlan Schedule 10)
- `https://maps.horizons.govt.nz/arcgis/rest/services/LocalMapsPublic/Public_OnePlan/MapServer/38`

### Coastal Hazard Zones
- `https://services1.arcgis.com/VuN78wcRdq1Oj69W/arcgis/rest/services/Coastal_Hazard_Zones/FeatureServer`

### Lahar Risk (Ruapehu)
- `https://services1.arcgis.com/VuN78wcRdq1Oj69W/arcgis/rest/services/Lahar_Risk_Ruapehu/FeatureServer`
  - Layer 2: Lahar Risk Zones

---

## 6. Greater Wellington Regional Council (additional layers)

### Flood Hazard Extents (newer version)
- `https://mapping.gw.govt.nz/arcgis/rest/services/Flood_Hazard_Extents_P/MapServer`
  - Layer 2: Flood hazard extents
  - Layer 3: 2% AEP
  - Layer 4: 1% AEP
  - Layer 5: 0.23% AEP

### Storm Surge
- `https://mapping.gw.govt.nz/arcgis/rest/services/Hazards/Storm_Surge/MapServer`
  - Layer 1-4: 1%AEP at 150cm/100cm/50cm/present day SLR

### Sea Level Rise
- `https://mapping.gw.govt.nz/arcgis/rest/services/Hazards/Sea_Level_Rise/MapServer`
  - Layers 1-25: MHWS10 DEM at 20cm increments (20cm-500cm)

---

## 7. Canterbury/ECan (additional rural layers)

### Kaikoura-specific
- Faults: `https://gis.ecan.govt.nz/arcgis/rest/services/Public/Geological_Hazards/MapServer/2`
- Folds: `https://gis.ecan.govt.nz/arcgis/rest/services/Public/Geological_Hazards/MapServer/3`
- Landslide Assessment: `https://gis.ecan.govt.nz/arcgis/rest/services/Public/Geological_Hazards/MapServer/8`
- Debris Fan: `https://gis.ecan.govt.nz/arcgis/rest/services/Public/Geological_Hazards/MapServer/10`

### Mackenzie Ostler Fault
- `https://gis.ecan.govt.nz/arcgis/rest/services/Public/EarthquakeFaultsLayers/MapServer/17` (fault lines/fold axes)
- `https://gis.ecan.govt.nz/arcgis/rest/services/Public/EarthquakeFaultsLayers/MapServer/18` (ground deformation)
- `https://gis.ecan.govt.nz/arcgis/rest/services/Public/EarthquakeFaultsLayers/MapServer/20` (Mackenzie DP hazard area)

### Canterbury Fault Awareness 2019
- `https://gis.ecan.govt.nz/arcgis/rest/services/Public/EarthquakeFaultsLayers/MapServer/0`

### Additional Liquefaction (rural districts)
- Kaikoura: `/MapServer/4` and `/MapServer/20`
- Mackenzie: `/MapServer/25` and `/MapServer/29`
- Waimate: `/MapServer/28`
- Waitaki: `/MapServer/26` and `/MapServer/30`

---

## 8. Otago Regional Council

### Storm Surge
- `https://maps.orc.govt.nz/arcgis/rest/services/Stormsurge_Affectedareas_allscenarios/MapServer`

### Waitaki River Floodplain
- `https://maps.orc.govt.nz/arcgis/rest/services/WaitakiRiverIndicativeFloodplain_DistrictPlanReview2021/MapServer`

### Waitaki Landslides
- `https://maps.orc.govt.nz/arcgis/rest/services/Hosted/Intersect_of_Landslides_w_StatsNZ_Waitaki_TA_Boundaries/FeatureServer`

### Flood Protection Bylaw 2022
- `https://maps.orc.govt.nz/arcgis/rest/services/FloodProtectionManagementBylaw2022/MapServer`
  - Layer 0: Drains and Overland Flow Paths
  - Layer 10: Floodways

### Coastal Hazard Areas (CoastPlan)
- `https://maps.orc.govt.nz/arcgis/rest/services/CoastPlan/MapServer/8`

---

## 9. West Coast Regional Council (additional)

### Coastal Hazard + Rockfall
- `https://gis.westcoast.govt.nz/arcgis/rest/services/EmergencyManagementAndHazards/Hazards/MapServer`
  - Layer 0: Coastal Hazard
  - Layer 1: Rockfall Hazard

### Tsunami Evacuation Zones
- `https://gis.westcoast.govt.nz/arcgis/rest/services/EmergencyManagementAndHazards/TsunamiEvacuationZones/MapServer`

### TTPP Hazard Overlays (Buller/Grey/Westland)
- `https://gis.westcoast.govt.nz/arcgis/rest/services/TeTaiOPoutiniPlan/TToPPDraftPlanData/MapServer`
  - Layer 5: Fault Avoidance Zone
  - Layer 6: Tsunami Hazard Zone
  - Layer 7: Flood Plain
  - Layer 10: Flood Hazard Severe
  - Layer 11: Flood Hazard Susceptibility
