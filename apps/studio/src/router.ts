import { useEffect, useState } from "react";

export type Route =
  | { name: "home"; section: "recents" | "files" | "archive" | "settings" }
  | { name: "studio"; section: "home" | "templates" | "projects" }
  | { name: "file"; id: string }
  | { name: "chat"; id?: string };

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "file" && parts[1]) {
    return { name: "file", id: decodeURIComponent(parts[1]) };
  }
  if (parts[0] === "chat") {
    return parts[1]
      ? { name: "chat", id: decodeURIComponent(parts[1]) }
      : { name: "chat" };
  }
  if (parts[0] === "studio") {
    const section = parts[1];
    return {
      name: "studio",
      section:
        section === "templates" || section === "projects" ? section : "home",
    };
  }
  const section = parts[0];
  return {
    name: "home",
    section:
      section === "files" || section === "archive" || section === "settings"
        ? section
        : "recents",
  };
}

export function href(route: Route): string {
  switch (route.name) {
    case "file":
      return `#/file/${encodeURIComponent(route.id)}`;
    case "chat":
      return route.id ? `#/chat/${encodeURIComponent(route.id)}` : "#/chat";
    case "studio":
      return route.section === "home"
        ? "#/studio"
        : `#/studio/${route.section}`;
    case "home":
      return route.section === "recents" ? "#/" : `#/${route.section}`;
  }
}

export function navigate(route: Route) {
  window.location.hash = href(route);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
