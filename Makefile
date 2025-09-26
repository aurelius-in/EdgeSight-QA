SHELL := /bin/bash

.PHONY: init build sbom sign policy.test deploy.dev qa.cert redteam.run

init:
python -m venv .venv || true
pip install -r services/results_adapter/requirements.txt || true

build:
docker build -t edgesight-qa:dev -f services/results_adapter/Dockerfile .

sbom:
mkdir -p security/sbom
curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b /usr/local/bin
syft packages docker-archive:$(shell docker save edgesight-qa:dev | echo /dev/stdin) -o spdx-json > security/sbom/syft-local.spdx.json || true

sign:
cosign sign --yes edgesight-qa:dev || true

policy.test:
curl -L https://github.com/open-policy-agent/conftest/releases/download/v0.53.0/conftest_0.53.0_Linux_x86_64.tar.gz | tar xz
./conftest test <(kustomize build serve) -p policy/opa || true

deploy.dev:
kubectl apply -k gitops/overlays/dev

qa.cert:
python -m adapters.results_api.app || true
python qa-cert/tests/test_certify.py

redteam.run:
bash redteam/run_redteam.sh