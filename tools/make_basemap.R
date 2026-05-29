#!/usr/bin/env Rscript
# Generate web/basemap.geojson for the City Timeline visualizer.
#
# Physical features only -- coastline, rivers, lakes, no political borders.
# The visualizer draws this as SVG under the city points, in the same
# projection, so the live site stays dependency-free (just static geodata).
#
# Install once:
#   install.packages(c("sf", "rnaturalearth", "rnaturalearthdata"))
# Run from the repo root:
#   Rscript tools/make_basemap.R
#
# Needs network the first time (Natural Earth river/lake layers download).

suppressPackageStartupMessages({
  library(sf)
  library(rnaturalearth)
})

# Clip box: generous Old-World core (Iberia -> India), covering the near-term
# roadmap. Widen xmax toward ~120 when coverage reaches East/Southeast Asia.
bbox     <- c(xmin = -12, ymin = 5, xmax = 75, ymax = 55)
crop_box <- st_as_sfc(st_bbox(bbox, crs = 4326))
scale    <- 50   # 1:50m medium scale; set 10 for hi-res (needs rnaturalearthhires)
out      <- "web/basemap.geojson"

safe <- function(expr, what) tryCatch(expr, error = function(e) {
  message("  (skipped ", what, ": ", conditionMessage(e), ")"); NULL
})

message("Fetching Natural Earth physical layers at 1:", scale, "m ...")
coast  <- safe(ne_coastline(scale = scale, returnclass = "sf"), "coastline")
lakes  <- safe(ne_download(scale = scale, type = "lakes",
                           category = "physical", returnclass = "sf"), "lakes")
rivers <- safe(ne_download(scale = scale, type = "rivers_lake_centerlines",
                           category = "physical", returnclass = "sf"), "rivers")

prep <- function(x, kind, keep_name = FALSE) {
  if (is.null(x) || nrow(x) == 0) return(NULL)
  x  <- st_make_valid(x)
  x  <- suppressWarnings(st_intersection(x, crop_box))
  if (nrow(x) == 0) return(NULL)
  x  <- st_simplify(x, dTolerance = 0.02, preserveTopology = TRUE)
  nm <- if (keep_name && "name" %in% names(x)) as.character(x$name) else NA_character_
  st_sf(kind = kind, name = nm, geometry = st_geometry(x))
}

layers <- Filter(Negate(is.null), list(
  prep(coast,  "coastline"),
  prep(lakes,  "lake"),
  prep(rivers, "river", keep_name = TRUE)
))
if (length(layers) == 0) stop("No layers produced -- check the network / installed packages.")
fc <- do.call(rbind, layers)

if (file.exists(out)) file.remove(out)
st_write(fc, out, driver = "GeoJSON", quiet = TRUE,
         layer_options = c("COORDINATE_PRECISION=3", "RFC7946=YES"))
message("Wrote ", out, " (", nrow(fc), " features).")
