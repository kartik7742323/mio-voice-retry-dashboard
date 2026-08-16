# Usage:
#   make sample   # regenerate synthetic demo data (Node)
#   make update   # process real Mongo dumps (Python) — edit paths below
#   make dev
#   make build

sample:
	node scripts/generate_sample_data.mjs

update:
	python scripts/process.py \
		--input ./mio-voice-mongo-data
	git add src/data public/data/campaigns
	git commit -m "data: refresh mio voice retry"

dev:
	npm run dev

build:
	npm run build

.PHONY: sample update dev build
