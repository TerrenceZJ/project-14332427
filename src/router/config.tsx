import type { RouteObject } from "react-router-dom";
import NotFound from "../pages/NotFound";
import Play from "../pages/play/page";
import Battle from "../pages/play/battle/page";

const routes: RouteObject[] = [
  {
    path: "/",
    element: <Play />,
  },
  {
    path: "/play/battle",
    element: <Battle />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
];

export default routes;
