SHELL := /usr/bin/env bash

install:
	@ pip install --upgrade build pip setuptools twine && \
	pip install -e .
build: install
	@ rm -rf dist/* && python -m build
publish: build
	@ python -m twine upload dist/*
publish-test: build
	@ python -m twine upload --repository testpypi dist/*
test:
	@ python -m pytest tests