##
# Copied from https://github.com/mbostock/world-atlas
#
# Check dependencies (curl, node, ogr2ogr, topojson) - details at URL above
# then run `make` to make the world geometry topo/world-10m.json

TOPOJSON = geo2topo
TOPOMERGE = topomerge
# http://www.naturalearthdata.com/downloads/
NATURAL_EARTH_CDN = https://naciscdn.org/naturalearth

all: topo/world-10m.json

.SECONDARY:

zip/ne_10m_%.zip:
	mkdir -p $(dir $@)
	curl "$(NATURAL_EARTH_CDN)/10m/cultural/ne_10m_$*.zip" -o $@.download
	mv $@.download $@

shp/ne_%_admin_0_countries.shp: zip/ne_%_admin_0_countries.zip
	mkdir -p $(dir $@)
	unzip -d shp $<
	touch $@

geo/ne_%_admin_0_countries.geojson: shp/ne_%_admin_0_countries.shp
	mkdir -p $(dir $@)
	ogr2ogr -f GeoJSON $@ $<

topo/world-%.json: geo/ne_%_admin_0_countries.geojson
	mkdir -p $(dir $@)
	$(TOPOJSON) \
		$< \
		--quantization 1e5 \
		> $@

