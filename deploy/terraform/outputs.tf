output "namespace" {
  value = kubernetes_namespace.edgesight.metadata[0].name
}


