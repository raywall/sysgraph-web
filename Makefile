.PHONY: run

install:
	@cd app && npm install --legacy-peer-deps

run:
	@cd app && ng serve