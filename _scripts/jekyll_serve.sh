#!/bin/bash
docker run --rm -v `pwd`:/site --net='host' -it bretfisher/jekyll serve -l
