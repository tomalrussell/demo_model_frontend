##
# Copied from https://github.com/mbostock/world-atlas
#
# Check dependencies (curl, node, ogr2ogr, topojson) - details at URL above
# then run `make` to make the world geometry topo/world-10m.json

TOPOJSON = topojson
TOPOMERGE = topojson-merge
# http://www.naturalearthdata.com/downloads/
NATURAL_EARTH_CDN = http://naciscdn.org/naturalearth

all: topo/world-10m.json

.SECONDARY:

zip/ne_10m_land.zip:
	mkdir -p $(dir $@)
	curl "$(NATURAL_EARTH_CDN)/10m/physical/ne_10m_land.zip" -o $@.download
	mv $@.download $@

zip/ne_10m_%.zip:
	mkdir -p $(dir $@)
	curl "$(NATURAL_EARTH_CDN)/10m/cultural/ne_10m_$*.zip" -o $@.download
	mv $@.download $@

zip/ne_50m_land.zip:
	mkdir -p $(dir $@)
	curl "$(NATURAL_EARTH_CDN)/50m/physical/ne_50m_land.zip" -o $@.download
	mv $@.download $@

zip/ne_50m_%.zip:
	mkdir -p $(dir $@)
	curl "$(NATURAL_EARTH_CDN)/50m/cultural/ne_50m_$*.zip" -o $@.download
	mv $@.download $@

zip/ne_110m_land.zip:
	mkdir -p $(dir $@)
	curl "$(NATURAL_EARTH_CDN)/110m/physical/ne_110m_land.zip" -o $@.download
	mv $@.download $@

zip/ne_110m_%.zip:
	mkdir -p $(dir $@)
	curl "$(NATURAL_EARTH_CDN)/110m/cultural/ne_110m_$*.zip" -o $@.download
	mv $@.download $@

# Admin 0 – land (3.17M)
shp/ne_%_land.shp: zip/ne_%_land.zip
	mkdir -p $(dir $@)
	unzip -d shp $<
	touch $@

# Admin 0 – countries (5.08M)
shp/ne_%_admin_0_countries.shp: zip/ne_%_admin_0_countries.zip
	mkdir -p $(dir $@)
	unzip -d shp $<
	touch $@

# Admin 0 – countries without boundary lakes (5.26M)
shp/ne_%_admin_0_countries_lakes.shp: zip/ne_%_admin_0_countries_lakes.zip
	mkdir -p $(dir $@)
	unzip -d shp $<
	touch $@

# Admin 1 - states, provinces (13.97M)
# - removes the redundant _shp suffix for consistency
shp/ne_%_admin_1_states_provinces.shp: zip/ne_%_admin_1_states_provinces_shp.zip
	mkdir -p $(dir $@)
	unzip -d shp $<
	for file in shp/ne_$*_admin_1_states_provinces_shp.*; do mv $$file shp/ne_$*_admin_1_states_provinces"$${file#*_shp}"; done
	touch $@

# Admin 1 - states, provinces without large lakes (14.11M)
# - removes the redundant _shp suffix for consistency
shp/ne_%_admin_1_states_provinces_lakes.shp: zip/ne_%_admin_1_states_provinces_lakes_shp.zip
	mkdir -p $(dir $@)
	unzip -d shp $<
	for file in shp/ne_$*_admin_1_states_provinces_lakes_shp.*; do mv $$file shp/ne_$*_admin_1_states_provinces_lakes"$${file#*_shp}"; done
	touch $@

topo/world-%.json: shp/ne_%_admin_0_countries.shp
	mkdir -p $(dir $@)
	$(TOPOJSON) \
		--quantization 1e5 \
		-s 0.00001 \
		--filter none \
		--id-property=ISO_A3 \
		-- countries=shp/ne_$*_admin_0_countries.shp \
		| $(TOPOMERGE) \
			-o $@ \
			--io=countries \
			--oo=land \
			--no-key
