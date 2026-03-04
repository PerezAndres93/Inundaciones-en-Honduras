// ================================================================================================================= //
// Elaborado por: Jorge Andrés Pérez escobar
// Objetivo: Visualizar las series de tiempo de precipitación
// Proyecto para que se elaboró: Inundaciones USAID
// Change Log: 
// - Última modificación: Ajuste de puntos de interés 27-05-2024 por Jorge
// ================================================================================================================= //

// ================================================================================================================= //
// PARAMETRIZACIÓN
// ================================================================================================================= //
//  -- Año de procesamiento --
var year_string = "2020";

// Asset de Terra-i en donde se guardará la imágen de referncia de tiempo seco
var ID_ASSET = 'users/ingperezescobar/floods_Hn/';
var roi = ee.FeatureCollection('users/ingperezescobar/floods_Hn/pais')//.bounds();

var wrapper = require('users/ingperezescobar/preprocess_SAR:wrapper');
var helper = require('users/ingperezescobar/preprocess_SAR:utilities');


var parameter = {//1. Data Selection
              START_DATE: year_string + "-01-01",
              STOP_DATE: year_string + "-12-31",
              POLARIZATION:'VV',
              ORBIT : 'DESCENDING',
              GEOMETRY: roi,
              //GEOMETRY: ee.Geometry.Polygon([[[104.80, 11.61],[104.80, 11.36],[105.16, 11.36],[105.16, 11.61]]], null, false), //Uncomment if providing coordinates
              //GEOMETRY: ee.Geometry.Polygon([[[112.05, -0.25],[112.05, -0.45],[112.25, -0.45],[112.25, -0.25]]], null, false),
              //2. Additional Border noise correction
              APPLY_ADDITIONAL_BORDER_NOISE_CORRECTION: true,
              //3.Speckle filter
              APPLY_SPECKLE_FILTERING: true,
              SPECKLE_FILTER_FRAMEWORK: 'MULTI',
              SPECKLE_FILTER: 'GAMMA MAP',
              SPECKLE_FILTER_KERNEL_SIZE: 15,
              SPECKLE_FILTER_NR_OF_IMAGES: 10,
              //4. Radiometric terrain normalization
              APPLY_TERRAIN_FLATTENING: false,
              DEM: ee.Image('USGS/SRTMGL1_003'),
              TERRAIN_FLATTENING_MODEL: 'VOLUME',
              TERRAIN_FLATTENING_ADDITIONAL_LAYOVER_SHADOW_BUFFER: 0,
              //5. Output
              FORMAT : 'DB',
              CLIP_TO_ROI: false,
              SAVE_ASSETS: false
}

//---------------------------------------------------------------------------//
// DO THE JOB
//---------------------------------------------------------------------------//
//Preprocess the S1 collection
var s1_preprocces = wrapper.s1_preproc(parameter);
//print("s1_wrapper",s1_preprocces)
//var s1 = s1_preprocces[0]
var s1collection_filter = s1_preprocces[1].select("VV")

// print("s1",s1)
// print("s1_preprocces",s1_preprocces)




// ================================================================================================================= //
// FECHAS
// ================================================================================================================= //
// ----- Fechas de proceso ----- //
var startDateSeason = ee.Date(year_string + '-01-01');
var startDateDry = ee.Date(year_string + '-01-01');
var endDateSeason = ee.Date(year_string + '-12-31');
var endDateDry = ee.Date(year_string + '-02-28');

// ----- Cantidad de días dentro del análisis ----- //
var ndays = ee.Number(endDateSeason.difference(startDateSeason,'day'));



// ================================================================================================================= //
// DATOS DE ENTRADA
// ================================================================================================================= //

// ******************************
// ** VECTORES **
// ******************************
// Región de interés se introduce un cuadro que incluya Honduras, para que no se consuma mucha
// memoria en el procesamiento



// Zonas inundadas identificadas por NOAA
var NOAA = ee.FeatureCollection('users/terraiciat/floods/NOAA_20201125_20201129_FloodExtent_Honduras')

// Punto para visualizar la serie de tiempo de índices y precipitación
var punto =ee.Geometry.Point([-86.79146609015095, 15.777723012252007]);


// ******************************
// ** RASTERES **
// ******************************
// A digital elevation model.
var dem = ee.Image('NASA/NASADEM_HGT/001').select('elevation').clip(roi);

// Colección CHIRPS diaria
var chirps = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY");



// ================================================================================================================= //
// CONVERSIÓN DE ELEVACIÓN A PENDIENTE
// ================================================================================================================= //
// Calculate slope. Units are degrees, range is [0,90).
var slope1 = ee.Terrain.slope(dem);

var slope = slope1.resample('bicubic').reproject({
  'crs': slope1.projection(),
  'scale': 10.0}).toInt()

// Seleccionar pendientes menores al 5 grados
slope = slope.lte(6)
slope = slope.updateMask(slope.eq(1))



// ================================================================================================================= //
// CREACIÓN DE IMAGENES DE REFERENCIA DE RETRODISPERSIÓN PARA TIEMPO DE INUNDACIÓN Y SECO
// ================================================================================================================= //
// Imagen de referencia en tiempo de inundación UNSPIDER
var img_reference_flood_median = ee.Image('users/ingperezescobar/floods_Hn/retrodispersion/img_reference_flood_median_retrodispersion');

//Imagen de referencia en tiempo seco UNSPIDER
var img_reference_median = ee.Image('users/ingperezescobar/floods_Hn/retrodispersion/img_reference_median_retrodispersion');

//Imagen de referencia en tiempo de inundación NDFI
var img_reference_flood_mean = ee.Image('users/ingperezescobar/floods_Hn/retrodispersion/img_reference_flood_mean_retrodispersion');

//Imagen de referencia en tiempo seco NDFI
var img_reference_mean = ee.Image('users/ingperezescobar/floods_Hn/retrodispersion/img_reference_mean_retrodispersion');

print("img_reference_median",img_reference_median)
Map.addLayer(img_reference_flood_median,{},"img_reference_flood_median")
Map.addLayer(img_reference_median,{},"img_reference_median")

// ================================================================================================================= //
// FUNCIONES PARA CREAR ÍNDICES NDFI Y UNSPIDER
// ================================================================================================================= //
// Función para aplicar el método NDFI
function ndfi_collection_index(img){
  var image = img.updateMask(slope);
  var ndfi = (img_reference_mean.subtract(img_reference_mean.min(image))).divide(img_reference_mean.add(img_reference_mean.min(image))).rename('NDFI').copyProperties(image, ["system:time_start", "system:index"]);

  return ndfi;
}

// Función para aplicar el método de UN_Spider
function UNSPIDER_collection_index(image){
    var img = image.updateMask(slope);
    var UN_Spider = img.divide(img_reference_median).rename("UN_Spider").copyProperties(img, ["system:time_start", "system:index"]);
    
    return UN_Spider;
}

function rnid_collection_index(image){
  var img = image.updateMask(slope);
  var rnid = (((img.subtract(img_reference_mean)).divide(img.add(img_reference_mean))).pow(0.5)).rename('rnid').copyProperties(img, ["system:time_start", "system:index"]);
  return rnid;
}

// Función para aplicar el método NDFI
function ndfvi_collection_index(img){
  var image = img.updateMask(slope);
  var ndfvi = (((image.max(img_reference_mean)).subtract(img_reference_mean)).divide((image.max(img_reference_mean)).add(img_reference_mean))).rename('ndfvi').copyProperties(image, ["system:time_start", "system:index"]);

  return ndfvi;
}



// ================================================================================================================= //
// APLICACIÓN DE FUNCIONES PARA CREAR ÍNDICES NDFI Y UNSPIDER
// ================================================================================================================= //
var ndfi_collection = s1collection_filter.filterDate(startDateSeason,endDateSeason)
                                         .map(ndfi_collection_index);

var unspider_collection = s1collection_filter.filterDate(startDateSeason,endDateSeason)
                                         .map(UNSPIDER_collection_index);

var rnid_collection = s1collection_filter.filterDate(startDateSeason,endDateSeason)
                                         .map(rnid_collection_index);

var ndfvi_collection = s1collection_filter.filterDate(startDateSeason,endDateSeason)
                                          .map(ndfvi_collection_index);

print("ndfi_collection",ndfi_collection)

// ==================================================================================================== //
// FUNCIONES DE TEMPORALIDAD
// ==================================================================================================== //
// función de cambios de temporalidad para la precipitación
function temporalidad(n, collection, name){
  var ini = startDateSeason.advance(n, 'day');
  var end = ini.advance(12, 'day');
  
  var by12 = collection.filterDate(ini, end)
                       .reduce(ee.Reducer.sum())
                       .set('system:time_start', ini)
                       .set('system:index', ee.String(n))
                       .rename(name)
  return by12
}

// función de cambios de temporalidad para los índices NDFI y UNSPIDER
function temporalidad_indices(n, collection, name){
  var ini = startDateSeason.advance(n, 'day');
  var end = ini.advance(12, 'day');
  
  var by12 = collection.filterDate(ini, end)
                       .reduce(ee.Reducer.mean())
                       .set('system:time_start', ini)
                       .set('system:index', ee.String(n))
                       .rename(name);
  return by12;
}



// ==================================================================================================== //
// APLICACIÓN DE FUNCIONES DE TEMPORALIDAD
// ==================================================================================================== //

var ndfi_collection_12 = ee.ImageCollection(
  ee.List.sequence({
    start: 0,
    end: ndays,
    step: 12
  }).map(function(n){
    return temporalidad_indices(n, ndfi_collection, "ndfi");
    }));

var unspider_collection_12 = ee.ImageCollection(
  ee.List.sequence({
    start: 0,
    end: ndays,
    step: 12
  }).map(function(n){
    return temporalidad_indices(n, unspider_collection, "unspider");
    }));

var rnid_collection_12 = ee.ImageCollection(
  ee.List.sequence({
    start: 0,
    end: ndays,
    step: 12
  }).map(function(n){
    return temporalidad_indices(n, rnid_collection, "rnid");
    }));

var ndfvi_collection_12 = ee.ImageCollection(
  ee.List.sequence({
    start: 0,
    end: ndays,
    step: 12
  }).map(function(n){
    return temporalidad_indices(n, ndfvi_collection, "ndfvi");
    }));



// ================================================================================================================= //
// CREACIÓN DE IMAGENES DE REFERENCIA PARA TIEMPO DE INUNDACIÓN Y SECO
// ================================================================================================================= //
// Imagen de referencia en tiempo de inundación UNSPIDER
var img_reference_flood_UNSPIDER_median = unspider_collection_12.filterDate('2020-11-01','2020-11-21').median();

//Imagen de referencia en tiempo seco UNSPIDER
var img_reference_Noflood_UNSPIDER_median = unspider_collection_12.filterDate(startDateDry,endDateDry).median();

//Imagen de referencia en tiempo de inundación NDFI
var img_reference_flood_NDFI_mean = ndfi_collection_12.filterDate('2020-11-01','2020-11-21').mean();

//Imagen de referencia en tiempo seco NDFI
var img_reference_Noflood_NDFI_mean = ndfi_collection_12.filterDate(startDateDry,endDateDry).mean();

//Imagen de referencia en tiempo de inundación NDFI
var img_reference_flood_rnid_mean = rnid_collection_12.filterDate('2020-11-01','2020-11-21').mean();

//Imagen de referencia en tiempo seco NDFI
var img_reference_Noflood_rnid_mean = rnid_collection_12.filterDate(startDateDry,endDateDry).mean();

//Imagen de referencia en tiempo de inundación NDFI
var img_reference_flood_ndfvi_mean = ndfvi_collection_12.filterDate('2020-11-01','2020-11-21').mean();

//Imagen de referencia en tiempo seco NDFI
var img_reference_Noflood_ndfvi_mean = ndfvi_collection_12.filterDate(startDateDry,endDateDry).mean();


print("img_reference_flood_UNSPIDER_median",img_reference_flood_UNSPIDER_median)
print("img_reference_flood_NDFI_mean",img_reference_flood_NDFI_mean)
// ================================================================================================================= //
// EXPORTAR IMAGENES DE ÍNDICES DE TIEMPOS SECOS E INUNDADOS
// ================================================================================================================= //
Export.image.toAsset({
  image: img_reference_flood_UNSPIDER_median,
  description: 'img_reference_Flooded_median_2020_UN',
  assetId: ID_ASSET + 'indices/img_reference_Flooded_median_2020_UN',
  region: geometry_f,
  scale: 10,
  maxPixels: 10000000000000});

Export.image.toAsset({
  image: img_reference_Noflood_UNSPIDER_median,
  description: 'img_reference_NoFlooded_median_2020_UN',
  assetId: ID_ASSET + 'indices/img_reference_NoFlooded_median_2020_UN',
  region: geometry_f,
  scale: 10,
  maxPixels: 10000000000000});

Export.image.toAsset({
  image: img_reference_flood_NDFI_mean,
  description: 'img_reference_Flooded_mean_2020_NDFI',
  assetId: ID_ASSET + 'indices/img_reference_Flooded_mean_2020_NDFI',
  region: geometry_f,
  scale: 10,
  maxPixels: 10000000000000});

Export.image.toAsset({
  image: img_reference_Noflood_NDFI_mean,
  description: 'img_reference_NoFlooded_mean_2020_NDFI',
  assetId: ID_ASSET + 'indices/img_reference_NoFlooded_mean_2020_NDFI',
  region: geometry_f,
  scale: 10,
  maxPixels: 10000000000000});

Export.image.toAsset({
  image: img_reference_flood_rnid_mean,
  description: 'img_reference_flood_rnid_mean_2020_rnid',
  assetId: ID_ASSET + 'indices/img_reference_Flooded_mean_2020_rnid',
  region: geometry_f,
  scale: 10,
  maxPixels: 10000000000000});

Export.image.toAsset({
  image: img_reference_Noflood_rnid_mean,
  description: 'img_reference_NoFlooded_mean_2020_rnid',
  assetId: ID_ASSET + 'indices/img_reference_NoFlooded_mean_2020_rnid',
  region: geometry_f,
  scale: 10,
  maxPixels: 10000000000000});

Export.image.toAsset({
  image: img_reference_flood_ndfvi_mean,
  description: 'img_reference_flood_ndfvi_mean_2020_ndfvi',
  assetId: ID_ASSET + 'indices/img_reference_Flooded_mean_2020_ndfvi',
  region: geometry_f,
  scale: 10,
  maxPixels: 10000000000000});

Export.image.toAsset({
  image: img_reference_Noflood_ndfvi_mean,
  description: 'img_reference_NoFlooded_mean_2020_ndfvi',
  assetId: ID_ASSET + 'indices/img_reference_NoFlooded_mean_2020_ndfvi',
  region: geometry_f,
  scale: 10,
  maxPixels: 10000000000000});
  

// ================================================================================================================= //
// Estilo de visualización
// ================================================================================================================= //
var Viz_index = {
  bands: ["ndfi"],
  max: 0,
  min: -0.205,
  opacity: 1,
  palette: ["020da8","0035ff","02ffea","04ff02","ffe204","ffa904","ff0000"]
};

var Viz_index2 = {
  bands: ["unspider"],
  max: 1.4,
  min: 0.5,
  opacity: 1,
  palette: ["ff0000","ffa904","ffe204","04ff02","02ffea","0035ff","020da8"]
};

var Viz_index3 = {
  bands: ["rnid"],
  max: 0.6,
  min: 0,
  opacity: 1,
  palette: ["ff0000","ffa904","ffe204","04ff02","02ffea","0035ff","020da8"]
};

var Viz_index4 = {
  bands: ["ndfvi"],
  max: 0,
  min: -0.232,
  opacity: 1,
  palette: ["ff0000","ffa904","ffe204","04ff02","02ffea","0035ff","020da8"]
};



// ================================================================================================================= //
// MAPA
// ================================================================================================================= //
Map.addLayer(img_reference_flood_NDFI_mean,Viz_index,"ndfi_collection_12");
Map.addLayer(img_reference_flood_UNSPIDER_median,Viz_index2,"unspider_collection_12");
Map.addLayer(img_reference_flood_rnid_mean,Viz_index3,"rnid_collection_12");
Map.addLayer(img_reference_flood_ndfvi_mean,Viz_index4,"ndfvi_collection_12");