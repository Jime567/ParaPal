APP_DIR := web-parapal
IMAGE_NAME := parapal
PORT := 8200

.PHONY: build docker-build docker-run clean

build:
	npm install --prefix $(APP_DIR)
	npm run build --prefix $(APP_DIR)

docker-build: build
	docker build -t $(IMAGE_NAME):latest .

docker-run:
	docker run --rm -p $(PORT):8200 $(IMAGE_NAME):latest

clean:
	rm -rf $(APP_DIR)/dist
