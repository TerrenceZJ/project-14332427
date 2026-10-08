import type { RouteObject } from "react-router-dom";
import NotFound from "../pages/NotFound";
import Play from "../pages/play/page";
import PlayMobile from "../pages/play/mobile/page";
import Battle from "../pages/play/battle/page";

const routes: RouteObject[] = [
  {
    path: "/",
    element: <Play />,
  },
  {
    path: "/mobile",
    element: <PlayMobile />,
  },
  {
    path: "/play/battle",
    element: <Battle />,
  },
  {
    path: "/play/battle/mobile",
    element: <Battle forceView="mobile" />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
];

export default routes;