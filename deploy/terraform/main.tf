resource "kubernetes_namespace" "edgesight" {
  metadata { name = "edgesight" }
}

resource "helm_release" "edgesight_qa" {
  name       = "edgesight-qa"
  repository = "file://../helm"
  chart      = "edgesight-qa"
  namespace  = kubernetes_namespace.edgesight.metadata[0].name
  values = [
    yamlencode({
      image = { repository = "ghcr.io/your-org", tag = "latest" }
    })
  ]
}


