export function getRouteFromHash() {
  if (window.location.hash.startsWith("#/")) {
    return window.location.hash.slice(1).split("?")[0];
  }

  return "/";
}

export function getHashSearchParam(key) {
  const hashValue = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const queryString = hashValue.includes("?") ? hashValue.split("?")[1] : "";
  const searchParams = new URLSearchParams(queryString);

  return searchParams.get(key);
}

export function goToRoute(route) {
  window.location.hash = route;
}
