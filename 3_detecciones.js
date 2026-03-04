// ================================================================================================================= //
// Elaborado por: Jorge Andrés Pérez escobar
// Objetivo: Visualizar las series de tiempo de precipitación
// Proyecto para que se elaboró: Inundaciones USAID
// Change Log: 
// - Última modificación: Ajuste de puntos de interés 27-05-2024 por Jorge
// - Última modificación: Ajuste de umbrales solamente para áreas de interes: 27-03-2025
// ================================================================================================================= //

// ================================================================================================================= //
// PARAMETRIZACIÓN
// ================================================================================================================= //
//  -- Año de procesamiento --
var year_string = "2020";

var sqrt = 52



// var day_smooth = 36;

// Indices a usar:
// NDFI_UNSPIDER_RNID_NDFVI
// NDFI_UNSPIDER
// NDFI_NDFVI
// NDFI_UNSPIDER_NDFVI

var indices_uso = 'NDFI_UNSPIDER';

var subcuencas = ee.FeatureCollection('projects/ee-terraiciat/assets/Subcuencas_wgs84');

var pais = ee.FeatureCollection('users/ingperezescobar/floods_Hn/pais');

var val_th_NDFI = 0.6 // -0.20 menores que  -------Mayor que
var val_th_UNSPIDER = 0.2 // 1.45; mayores a  ------ Menor que
var val_th_rnid = 0.5197494682007111 // 0.5 mayor que
var val_th_NDFVI = -0.042523893134507995 // -0.20; menor que

var th_NDFI = val_th_NDFI;
var th_rnid = val_th_rnid;
var th_UNSPIDER = val_th_UNSPIDER;
var th_NDFVI = val_th_NDFVI;


// The grid size in meters.
var scale = 50000;
// Creating the fishnet grid.
var grid = ee.FeatureCollection(pais.geometry().coveringGrid('EPSG:4326', scale));

var tile = sqrt;
var grid2 = ee.Feature(grid.toList(75).get(tile));
grid2 = ee.FeatureCollection(grid2)



// ================================================================================================================= //
// PARAMETRIZACIÓN
// ================================================================================================================= //

// Asset de Terra-i en donde se guardará la imágen de referncia de tiempo seco
var ID_ASSET = 'users/ingperezescobar/floods_Hn/';
//var roi = ee.FeatureCollection('users/ingperezescobar/floods_Hn/pais')//.bounds();

var roi = grid2;

var wrapper = require('users/ingperezescobar/preprocess_SAR:wrapper');
var helper = require('users/ingperezescobar/preprocess_SAR:utilities');


var parameter = {//1. Data Selection
              START_DATE: year_string + "-01-01",
              STOP_DATE: year_string + "-12-31",
              POLARIZATION:'VV',
              ORBIT : 'DESCENDING',
              GEOMETRY: roi,
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
var s1collection_filter = s1_preprocces[1].select(parameter.POLARIZATION);

print("s1collection_filter", s1collection_filter)



// ================================================================================================================= //
// FECHAS
// ================================================================================================================= //
// ----- Fechas de proceso ----- //
var startDateSeason = ee.Date(year_string + '-01-01');
var startDateDry = ee.Date(year_string + '-01-01');
var endDateSeason = ee.Date(year_string + '-12-31');
var endDateDry = ee.Date(year_string + '-02-28');

// ----- Cantidad de días dentro del análisis ----- //
var ndays = ee.Number(endDateSeason.difference(startDateSeason,'day')).round().subtract(12);




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



// ================================================================================================================= //
// FUNCIONES PARA CREAR ÍNDICES NDFI, UNSPIDER, y rnid
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
                                         
// ----- Colección de CHIRPS filtrada por fechas y ROI ----- //
var chirps_collection = chirps.filterDate(startDateSeason, endDateSeason)
                              .filterBounds(roi);




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
                       .set('timestamp', (ini).millis())
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
                       .set('timestamp', (ini).millis())
                       .set('system:index', ee.String(n))
                       .rename(name)
  return by12
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
    
var chirps_collection_12 = ee.ImageCollection(
  ee.List.sequence({
    start: 0,
    end: ndays,
    step: 12
  }).map(function(n){
    return temporalidad(n, chirps_collection, "precipitacion");
    }));


// // ================================================================================================================= //
// // FUNCION DE SUAVIZADO DE LA SERIE TEMPORAL
// // ================================================================================================================= //

// function smothing(days_1, col, band){
//   // Specify the time-window
//   var days = days_1;

//   // Convert to milliseconds 
//   var millis = ee.Number(days);

//   // We use a 'save-all join' to find all images 
//   // that are within the time-window

//   // The join will add all matching images into a
//   // new property called 'images'
//   var join = ee.Join.saveAll({
//     matchesKey: 'images'
//   });

//   // This filter will match all images that are captured
//   // within the specified day of the source image
//   var diffFilter = ee.Filter.maxDifference({
//     difference: millis,
//     leftField: 'timestamp', 
//     rightField: 'timestamp'
//   });


//   var joinedCollection = join.apply({
//     primary: col, 
//     secondary: col, 
//     condition: diffFilter
//   });

//   // Each image in the joined collection will contain
//   // matching images in the 'images' property
//   // Extract and return the mean of matched images
//   var extractAndComputeMean = function(image) {
//     var matchingImages = ee.ImageCollection.fromImages(image.get('images'));
//     var meanImage = matchingImages.reduce(
//       ee.Reducer.mean().setOutputs(['moving_average']));
//     return ee.Image(image).addBands(meanImage);
//   };

//   var smoothedCollection = ee.ImageCollection(
//     joinedCollection.map(extractAndComputeMean));
  
//   return smoothedCollection.select(band);

// }


// ndfi_collection_12 = smothing(day_smooth, ndfi_collection_12, "ndfi_moving_average")
// print("ndfi_collection_12",ndfi_collection_12)
// unspider_collection_12 = smothing(day_smooth, unspider_collection_12, "unspider_moving_average")

// ================================================================================================================= //
// CREACIÓN DE IMAGENES DE REFERENCIA PARA TIEMPO DE INUNDACIÓN Y SECO DE LOS INDICES
// ================================================================================================================= //
// Imagen de referencia en tiempo de inundación UNSPIDER
var img_reference_flood_UNSPIDER_median = ee.Image('users/ingperezescobar/floods_Hn/indices/img_reference_Flooded_median_2020_UN');
//Imagen de referencia en tiempo seco UNSPIDER
var img_reference_Noflood_UNSPIDER_median = ee.Image('users/ingperezescobar/floods_Hn/indices/img_reference_NoFlooded_median_2020_UN');
//Imagen de referencia en tiempo de inundación NDFI
var img_reference_flood_NDFI_mean = ee.Image('users/ingperezescobar/floods_Hn/indices/img_reference_Flooded_mean_2020_NDFI');
//Imagen de referencia en tiempo seco NDFI
var img_reference_Noflood_NDFI_mean = ee.Image('users/ingperezescobar/floods_Hn/indices/img_reference_NoFlooded_mean_2020_NDFI');
//Imagen de referencia en tiempo de inundación NDFI
var img_reference_flood_rnid_mean = ee.Image('users/ingperezescobar/floods_Hn/indices/img_reference_Flooded_mean_2020_rnid');

//Imagen de referencia en tiempo seco NDFI
var img_reference_Noflood_rnid_mean = ee.Image('users/ingperezescobar/floods_Hn/indices/img_reference_NoFlooded_mean_2020_rnid')

//Imagen de referencia en tiempo de inundación NDFI
var img_reference_flood_NDFVI_mean = ee.Image('users/ingperezescobar/floods_Hn/indices/img_reference_Flooded_mean_2020_ndfvi');

//Imagen de referencia en tiempo seco NDFI
var img_reference_Noflood_NDFVI_mean = ee.Image('users/ingperezescobar/floods_Hn/indices/img_reference_NoFlooded_mean_2020_ndfvi')



// ================================================================================================================= //
// FUNCIÓN DE DETECCIÓN DE INUNDACIONES
// ================================================================================================================= //
function flood_detection(n, collection, threshold){
  var ini = startDateSeason.advance(n,'day');
  var end = ini.advance(12,'day');
  
  if( collection == "ndfi"){
    collection = ndfi_collection_12;
    
    var img_ini = collection.filterDate(ini,end) // Seleccionar la primera imágen dentro de los 12 días
                            .reduce(ee.Reducer.first()) // Identificación de la primera imagen de la colección filtrada de UNSPIDER
                            .set('system:time_start', ini);
    
    var agua_mask_ini = img_ini.gt(threshold);
    var agua_date_ini = agua_mask_ini.updateMask(agua_mask_ini.eq(1)).rename('INI');
    
    var img_end = collection.filterDate(ini,end) // Seleccionar la primera imágen dentro de los 12 días
                            .reduce(ee.Reducer.last()) // Identificación de la primera imagen de la colección filtrada de UNSPIDER
                            .set('system:time_start', end);
    
    var agua_mask_end = img_end.gt(threshold);
    var agua_date_end = agua_mask_end.updateMask(agua_mask_end.eq(1)).rename('END');
  }
  
  if( collection == "unspider"){
    collection = unspider_collection_12;
    
    var img_ini = collection.filterDate(ini,end) // Seleccionar la primera imágen dentro de los 12 días
                            .reduce(ee.Reducer.first()) // Identificación de la primera imagen de la colección filtrada de UNSPIDER
                            .set('system:time_start', ini);
    
    var agua_mask_ini = img_ini.lt(threshold);
    var agua_date_ini = agua_mask_ini.updateMask(agua_mask_ini.eq(1)).rename('INI');
    
    var img_end = collection.filterDate(ini,end) // Seleccionar la primera imágen dentro de los 12 días
                            .reduce(ee.Reducer.last()) // Identificación de la primera imagen de la colección filtrada de UNSPIDER
                            .set('system:time_start', end);
    
    var agua_mask_end = img_end.lt(threshold);
    var agua_date_end = agua_mask_end.updateMask(agua_mask_end.eq(1)).rename('END');
  }
  
  if( collection == "rnid"){
    collection = rnid_collection_12;
    
    var img_ini = collection.filterDate(ini,end) // Seleccionar la primera imágen dentro de los 12 días
                            .reduce(ee.Reducer.first()) // Identificación de la primera imagen de la colección filtrada de UNSPIDER
                            .set('system:time_start', ini);
    
    var agua_mask_ini = img_ini.gt(threshold);
    var agua_date_ini = agua_mask_ini.updateMask(agua_mask_ini.eq(1)).rename('INI');
    
    var img_end = collection.filterDate(ini,end) // Seleccionar la primera imágen dentro de los 12 días
                            .reduce(ee.Reducer.last()) // Identificación de la primera imagen de la colección filtrada de UNSPIDER
                            .set('system:time_start', end);
    
    var agua_mask_end = img_end.gt(threshold);
    var agua_date_end = agua_mask_end.updateMask(agua_mask_end.eq(1)).rename('END');
  }
  
  if( collection == "ndfvi"){
    collection = ndfi_collection_12;
    
    var img_ini = collection.filterDate(ini,end) // Seleccionar la primera imágen dentro de los 12 días
                            .reduce(ee.Reducer.first()) // Identificación de la primera imagen de la colección filtrada de UNSPIDER
                            .set('system:time_start', ini);
    
    var agua_mask_ini = img_ini.lt(threshold);
    var agua_date_ini = agua_mask_ini.updateMask(agua_mask_ini.eq(1)).rename('INI');
    
    var img_end = collection.filterDate(ini,end) // Seleccionar la primera imágen dentro de los 12 días
                            .reduce(ee.Reducer.last()) // Identificación de la primera imagen de la colección filtrada de UNSPIDER
                            .set('system:time_start', end);
    
    var agua_mask_end = img_end.lt(threshold);
    var agua_date_end = agua_mask_end.updateMask(agua_mask_end.eq(1)).rename('END');
  }
  
  
  
  // Selección de pixeles donde al menos hay dos fechas consecutivas de detección
  var continuidad = agua_date_ini.add(agua_date_end); // sumatoria de imágenes binarias con detección de inundación
  var continuidad_eva = continuidad.gte(1); // Selección de valores mayores o iguales a 2, que corresponde a dos o más fechas inundadas consecutivas
  var coninuidad_final = continuidad_eva.updateMask(continuidad_eva.eq(1)).set('inicio_inundacion',ini).set('final_inundacion',end).copyProperties(img_ini, ["system:time_start"]) // Enmascarado de las detecciones, usando como el filtro de dos o más fechas consecutivas de detección
  
  // Renombrar imagen de deteccion de inundaciones
  coninuidad_final = ee.Image(coninuidad_final).rename("Flooded"); // Dato final de detecciones de inundación usando UNSPIDER
    
  // Crear una banda con el dia del año
  var doy = ee.Date(coninuidad_final.get('system:time_start')).getRelative('day', 'year'); // extracción del día del año
  var doyBand = ee.Image.constant(doy).uint16().rename('doy'); // Creación de banda con el dia del año
  doyBand = doyBand.updateMask(coninuidad_final); // Enmascarado del día del año con la banda de filtro de fechas consecutivas
 
  // Crear una imagen multibanda. una banda binarizada de detección (0: no inundado y 1: inundado) y otra con el día de la inundación
  return coninuidad_final.addBands(doyBand)
}



// ================================================================================================================= //
// APLICACIÓN DE FUNCIÓN DE INUNDACIONES
// ================================================================================================================= //
// Conversión de imágenes diarias a imágenes cada 12 días
var ndfi_detected = ee.ImageCollection(
  ee.List.sequence({
    start: 0, //valor inicial de la lista de días
    end: ndays, //valor final de la lista de días
    step: 12 //La secuencia avanza cada 12 díass (12 días a la vez en cada iteración)
    }).map(function(n){
      return flood_detection(n, "ndfi", th_NDFI);
    }));

var unspider_detected = ee.ImageCollection(
  ee.List.sequence({
    start: 0, //valor inicial de la lista de días
    end: ndays, //valor final de la lista de días
    step: 12 //La secuencia avanza cada 12 díass (12 días a la vez en cada iteración)
    }).map(function(n){
      return flood_detection(n, "unspider", th_UNSPIDER);
    }));

var rnid_detected = ee.ImageCollection(
  ee.List.sequence({
    start: 0, //valor inicial de la lista de días
    end: ndays, //valor final de la lista de días
    step: 12 //La secuencia avanza cada 12 díass (12 días a la vez en cada iteración)
    }).map(function(n){
      return flood_detection(n, "rnid", th_rnid);
    }));

var ndfvi_detected = ee.ImageCollection(
  ee.List.sequence({
    start: 0, //valor inicial de la lista de días
    end: ndays, //valor final de la lista de días
    step: 12 //La secuencia avanza cada 12 díass (12 días a la vez en cada iteración)
    }).map(function(n){
      return flood_detection(n, "ndfvi", th_NDFVI);
    }));

// ================================================================================================================= //
// DETECCIONES DE LA PRIMERA FECHA DE INUNDACIÓN Y LA CANTIDAD DE VECES INUNDADO
// ================================================================================================================= //
var detection_ndfi_min = ndfi_detected.select("doy").min().int().rename('Flooded'); //Extracción del primer día inundado

var detection_unspider_min = unspider_detected.select("doy").min().int().rename('Flooded'); //Extracción del primer día inundado

var detection_rnid_min = rnid_detected.select("doy").min().int().rename('Flooded'); 

var detection_ndfvi_min = ndfvi_detected.select("doy").min().int().rename('Flooded'); 


// Indices a usar:
// NDFI_UNSPIDER_RNID_NDFVI
// NDFI_UNSPIDER
// NDFI_NDFVI
// NDFI_UNSPIDER_NDFVI


if(indices_uso = 'NDFI_UNSPIDER'){
  var final = ee.ImageCollection([unspider_detected.select("doy").min(), ndfi_detected.select("doy").min()]).max().rename('Flooded');
}



// ================================================================================================================= //
// FUSIÓN DE IMAGENES PARA SELECCIONAR LA FECHA MÁS RECIENTE
// ================================================================================================================= //
// tomado de: https://gis.stackexchange.com/questions/327904/combine-two-image-collections-into-one-image-collection-earth-engine
var filter = ee.Filter.equals({
  leftField: 'system:time_start',
  rightField: 'system:time_start'
});

// Create the join.
var simpleJoin = ee.Join.inner();

// Inner join
var innerJoin = ee.ImageCollection(simpleJoin.apply(ndfi_detected.select("doy"), unspider_detected.select("doy"), filter));

var joined = innerJoin.map(function(feature) {
  return ee.Image.cat(feature.get('primary'), feature.get('secondary'));
});



// Inner join
var innerJoin2 = ee.ImageCollection(simpleJoin.apply(joined, rnid_detected.select("doy"), filter));

var joined2 = innerJoin2.map(function(feature) {
  return ee.Image.cat(feature.get('primary'), feature.get('secondary'));
});


// Inner join
var innerJoin3 = ee.ImageCollection(simpleJoin.apply(joined2, ndfvi_detected.select("doy"), filter));

var joined3 = innerJoin3.map(function(feature) {
  return ee.Image.cat(feature.get('primary'), feature.get('secondary'));
});


// ================================================================================================================= //
// CONVERTIR COLECCIÓN DE ÍNDICES RASTERES A COLECCION DE SHAPEFILES
// ================================================================================================================= //
var collection = joined3;


// Función para extraer estadísticas de cada imagen
var imageToFeature = function(image) {
  var img1 = image.select("doy").unmask(0);
  var img2 = image.select("doy_1").rename("doy").unmask(0);
  var img3 = image.select("doy_2").rename("doy").unmask(0);
  var img4 = image.select("doy_2").rename("doy").unmask(0);
  
  if(indices_uso == 'NDFI_UNSPIDER_RNID_NDFVI'){
    var imagen = ee.ImageCollection([img1, img2, img3, img4]).reduce(ee.Reducer.max()).clip(roi).rename("doy");
  }
  
  if(indices_uso == 'NDFI_UNSPIDER_NDFVI'){
    var imagen = ee.ImageCollection([img1, img2, img4]).reduce(ee.Reducer.max()).clip(roi).rename("doy");
  }
  
  if(indices_uso == 'NDFI_UNSPIDER'){
    var imagen = ee.ImageCollection([img1, img2]).reduce(ee.Reducer.max()).clip(roi).rename("doy");
  }
  
  if(indices_uso == 'NDFI_NDFVI'){
    var imagen = ee.ImageCollection([img1, img4]).reduce(ee.Reducer.max()).clip(roi).rename("doy");
  }



  
  var rtov = imagen.reduceToVectors({
    geometry: roi.geometry().bounds(),
    crs: imagen.projection(),
    scale: 10,
    geometryType: 'polygon',
    eightConnected: false,
    bestEffort: true,
    tileScale: 2,
    maxPixels: 10000000000000
  })
  
  return rtov;
};

var collection2 = collection.map(imageToFeature).flatten();
print("collection2",collection2.limit(5));





// ================================================================================================================= //
// ESTILO DE VISUALIZACIÓN
// ================================================================================================================= //
var Viz_min = {
  bands: ["Flooded"],
  max: 365,
  min: 1,
  opacity: 1,
  palette: ["#0402ff","#08fff2","#04ff0a","#0b7804"]
};

var Viz_sum = {
  bands: ["Flooded"],
  max: 31,
  min: 1,
  opacity: 1,
  palette: ["#0402ff","#08fff2","#04ff0a","#0b7804"]
};



// ================================================================================================================= //
// MAPAS
// ================================================================================================================= //
// Map.centerObject(roi, 10);
Map.addLayer(NOAA,{},"NOAA", false);
Map.addLayer(roi, {}, "roi", true);
Map.addLayer(final.clip(roi),Viz_min,"DOY final", true);


var punto1 = ee.Feature(ee.Geometry.Point([-87.657055549999995, 14.348815200000001])).set("punto", 1);
var punto2 = ee.Feature(ee.Geometry.Point([-86.490415389999995, 13.963224660000000])).set("punto", 2);
var punto3 = ee.Feature(ee.Geometry.Point([-87.331319989999997, 13.186080069999999])).set("punto", 3);
var punto4 = ee.Feature(ee.Geometry.Point([-87.415763589999997, 13.164510390000000])).set("punto", 4);



var puntos_agrupados = ee.FeatureCollection([punto1,punto2,punto3,punto4]);


Map.addLayer(puntos_agrupados, {}, "puntos", false);


// ================================================================================================================= //
// EXPORTAR DATOS
// ================================================================================================================= //
Export.table.toDrive({
  collection: collection2,
  //description: cuenca + '_' + indices_uso + '_sqrt_' + sqrt + '_' + year_string,
  description: indices_uso + '_sqrt_' + sqrt + '_' + year_string,
  folder: "00_Floods",
  fileFormat: "SHP"});


// ================================================================================================================= //
// UNIR COLECCIONES 
// ================================================================================================================= //
// Filtro para organizar imagenes por fecha
var filter = ee.Filter.equals({
  leftField: 'system:time_start',
  rightField: 'system:time_start'});

// Union interna
var simpleJoin = ee.Join.inner();

// Union entre NDFI y Precipitación
var innerJoin_ndfi_rain = ee.ImageCollection(simpleJoin.apply(ndfi_collection_12, chirps_collection_12, filter));


// Union entre UN-Spider y precipitación
var innerJoin_unspider_rain = ee.ImageCollection(simpleJoin.apply(unspider_collection_12, chirps_collection_12, filter));

// Union entre UN-Spider y precipitación
var innerJoin_rnid_rain = ee.ImageCollection(simpleJoin.apply(rnid_collection_12, chirps_collection_12, filter));

// Union entre NDFI y Precipitación
var innerJoin_ndfvi_rain = ee.ImageCollection(simpleJoin.apply(ndfvi_collection_12, chirps_collection_12, filter));


// Union entre colecciones de NDFI y precipitación
var joined_ndfi_rain = innerJoin_ndfi_rain.map(function(feature) {
  return ee.Image.cat(feature.get('primary'), feature.get('secondary'))});

// Union entre colecciones de UN-Spider y precipitación
var joined_unspider_rain = innerJoin_unspider_rain.map(function(feature) {
  return ee.Image.cat(feature.get('primary'), feature.get('secondary'))});

// Union entre colecciones de UN-Spider y precipitación
var joined_rnid_rain = innerJoin_rnid_rain.map(function(feature) {
  return ee.Image.cat(feature.get('primary'), feature.get('secondary'))});

// Union entre colecciones de UN-Spider y precipitación
var joined_ndfvi_rain = innerJoin_ndfvi_rain.map(function(feature) {
  return ee.Image.cat(feature.get('primary'), feature.get('secondary'))});
  

// ==================================================================================================== //
// SERIES DE TIEMPO 
// ==================================================================================================== //
// Function to handle map clicks
var onClick = function(coords) {
  var punto = ee.Geometry.Point(coords.lon, coords.lat);
  // ----- NDFI and precipitation time serie ----- //
  print(ui.Chart.image.series({
    imageCollection: joined_ndfi_rain,
    region: punto,
    reducer: ee.Reducer.mean(),
    scale: 10
  }).setOptions({
      title: year_string + ': NDFI method and accumulated precipitation by 12 days',
      gridlines: {color: 'FFFFFF'},
      series: {
        0: {targetAxisIndex: 0, type: 'line', lineWidth: 1, color: 'green'},
        1: {targetAxisIndex: 1, type: 'line', lineWidth: 1, color: 'blue'}
      },
      hAxis:
      {title: 'Time', titleTextStyle: {italic: false, bold: true}},
      vAxes: {
        0: {
          gridlines: {color: 'FFFFFF'},
          title: 'NDFI',
          titleTextStyle: {italic: false, bold: true, color: 'green'}
        },
        1: {
          title: 'Precipitation (mm/12days)',
          titleTextStyle: {italic: false, bold: true, color: 'blue'}
        },
      },
      curveType: 'function'
    })
  );

  // ----- UN-SPIDER and precipitation time serie ----- //
  print(ui.Chart.image.series({
    imageCollection: joined_unspider_rain,
    region: punto,
    reducer: ee.Reducer.mean(),
    scale: 10
  }).setOptions({
      title: year_string + ': UN-SPIDER method and accumulated precipitation by 12 days',
      gridlines: {color: 'FFFFFF'},
      series: {
        0: {targetAxisIndex: 0, type: 'line', lineWidth: 1, color: 'blue'},
        1: {targetAxisIndex: 1, type: 'line', lineWidth: 1, color: 'green'}
        },
      hAxis:
        {title: 'Time', titleTextStyle: {italic: false, bold: true}},
      vAxes: {
        0: {
          gridlines: {color: 'FFFFFF'},
          title: 'Precipitation (mm/12days)',
          titleTextStyle: {italic: false, bold: true, color: 'blue'}
        },
        1: {
          title: 'UN-SPIDER',
          titleTextStyle: {italic: false, bold: true, color: 'green'}
        },
      },
      curveType: 'function'
    })
  );


  // // ----- UN-SPIDER and precipitation time serie ----- //
  // print(ui.Chart.image.series({
  //   imageCollection: joined_rnid_rain,
  //   region: punto,
  //   reducer: ee.Reducer.mean(),
  //   scale: 10
  // }).setOptions({
  //     title: year_string + ': RNID method and accumulated precipitation by 12 days',
  //     gridlines: {color: 'FFFFFF'},
  //     series: {
  //       0: {targetAxisIndex: 0, type: 'line', lineWidth: 1, color: 'blue'},
  //       1: {targetAxisIndex: 1, type: 'line', lineWidth: 1, color: 'green'}
  //     },
  //     hAxis:
  //       {title: 'Time', titleTextStyle: {italic: false, bold: true}},
  //     vAxes: {
  //       0: {
  //         gridlines: {color: 'FFFFFF'},
  //         title: 'Precipitation (mm/12days)',
  //         titleTextStyle: {italic: false, bold: true, color: 'blue'}
  //       },
  //       1: {
  //         title: 'RNID',
  //         titleTextStyle: {italic: false, bold: true, color: 'green'}
  //       },
  //     },
  //     curveType: 'function'
  //   })
  // );
  
  // ----- UN-SPIDER and precipitation time serie ----- //
  // print(ui.Chart.image.series({
  //   imageCollection: joined_ndfvi_rain,
  //   region: punto,
  //   reducer: ee.Reducer.mean(),
  //   scale: 10
  // }).setOptions({
  //     title: year_string + ': NDFVI method and accumulated precipitation by 12 days',
  //     gridlines: {color: 'FFFFFF'},
  //     series: {
  //       0: {targetAxisIndex: 0, type: 'line', lineWidth: 1, color: 'green'},
  //       1: {targetAxisIndex: 1, type: 'line', lineWidth: 1, color: 'blue'}
  //     },
  //     hAxis:
  //       {title: 'Time', titleTextStyle: {italic: false, bold: true}},
  //     vAxes: {
  //       0: {
  //         gridlines: {color: 'FFFFFF'},
  //         title: 'NDFVI',
  //         titleTextStyle: {italic: false, bold: true, color: 'green'}
  //       },
  //       1: {
  //         title: 'Precipitation (mm/12days)',
  //         titleTextStyle: {italic: false, bold: true, color: 'blue'}
  //       },
  //     },
  //     curveType: 'function'
  //   })
  // );
};

// Add a click event listener to the map
Map.onClick(onClick);
// Map.setOptions('HYBRID');



