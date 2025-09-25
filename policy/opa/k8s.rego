package policy

deny[msg] {
  input.kind == "Deployment"
  some c
  c := input.spec.template.spec.containers[_]
  re_match(".*:latest$", c.image)
  msg := "deny: image tag latest is not allowed"
}

deny[msg] {
  some c
  c := input.spec.template.spec.containers[_]
  not c.resources
  msg := "deny: resources required"
}

deny[msg] {
  some c
  c := input.spec.template.spec.containers[_]
  not c.resources.limits
  msg := "deny: resources.limits required"
}

deny[msg] {
  input.kind == "NetworkPolicy"
  not input.spec.podSelector
  msg := "deny: networkPolicy selector required"
}