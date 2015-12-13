# Global trade model front-end

Prototype web-based visualisation/game, intended to run locally next to the
[demo_model](https://github.com/roblevy/demo-model).

## Developing

Run [sass](http://sass-lang.com/) to compile CSS:

    sass styles/main.scss styles/main.css --style compressed

Run `make` in the data directory to download Natural Earth data and convert
to topojson.

Currently assumes that the demo_model server is running on `localhost:5000`.