terraform {
  required_providers {
    kubernetes = { source = "hashicorp/kubernetes", version = ">= 2.23.0" }
    helm       = { source = "hashicorp/helm",       version = ">= 2.13.0" }
  }
}

provider "kubernetes" {}
provider "helm" {}


