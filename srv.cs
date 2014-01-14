using System;
using System.Collections.Generic;
using System.Net;
using System.IO;
using System.Text;
using System.Linq;

using libGTS.Data.Static;
using libGTS.Data.Dynamic;
using libGTS.Utility;
using libGTS.Routes;
using libGTS.Types;

class Srv {
  static void Main(string[] args) {
    StaticStore.ReadFromFile();
    StaticStore.RebuildHashTables();
    DynamicStore.ReadFromFile();

    var srv = new HttpListener();
    srv.Prefixes.Add("http://*:23455/");
    srv.Start();
    using (srv) {
      for (;;) {
        Handle(srv.GetContext());
      }
    }
  }

  static void Handle(HttpListenerContext c) {
    var request = c.Request;
    var path = request.RawUrl;
    var headers = request.Headers;
    var response = c.Response;
    using (response)
    {
        if (path.StartsWith("/files/"))
        {
            var filename = path.Split('/').Last();
            if (DeliverFile(response, filename) == false)
            {
                response.StatusCode = (int)HttpStatusCode.BadRequest;
            }
        }
        else if (path.StartsWith("/api/systemid/"))
        {
            var id = headers["EVE_SOLARSYSTEMID"];
            response.ContentType = "application/json";
            RespondWith(response, "{ \"id\": \"" + id + "\"}");
        }
        else if (path.StartsWith("/api/gate-route/"))
        {
            var end = path.Split('/').Last();
            var start = headers["EVE_SOLARSYSTEMNAME"];
            if (DeliverGateRoute(response, start, end) == false)
            {
                response.StatusCode = (int)HttpStatusCode.BadRequest;
            }
        }
        else
        {
            DeliverFile(response);
        }
    }
  }

  static bool DeliverFile(HttpListenerResponse response, string filename = "index.html")
  {
      var validFiles = new Dictionary<string, string>
                        {
                            {"index.html", "text/html;charset=utf-8"},
                            {"style.css", "text/css;charset=utf-8"},
                            {"app.js", "text/javascript;charset=utf-8"}
                        };

      if (validFiles.ContainsKey(filename))
      {
          response.ContentType = validFiles[filename];
          RespondWith(response, File.ReadAllBytes(filename));
          return true;
      }
      return false;
  }

  static bool DeliverGateRoute(HttpListenerResponse response, string startSystem, string endSystem)
  {
      var start = LookupSystem(startSystem);
      var end = LookupSystem(endSystem);
      if (end == null)
          return false;

      var routeParams = new GateRouteParameters();
      routeParams.RoutingOption = GateRouteOption.UseBridges;
      routeParams.ShipMass = 1f;

      var router = new GateRouter(routeParams);
      List<Vertex> path;
      router.GetShortestPath(start, end, out path);

      if (path.Count == 0)
          return false;

      response.ContentType = "text/plain";

      var b = new StringBuilder();
      b.Append("{\"route\": [\n");

      foreach (var jump in path)
      {
          b.Append("{");

          b.Append("\"name\":\"").Append(jump.SolarSystem.Name).Append("\",");
          b.Append("\"id\":\"").Append(jump.SolarSystem.ID).Append("\",");
          b.Append("\"type\":\"").Append(jump.JumpType).Append("\"");

          if (jump.JumpType == JumpType.Bridge)
          {
              b.Append(",\"pos\":\"").Append(jump.Bridge.Pos.Planet).Append("-").Append(jump.Bridge.Pos.Moon).Append("\"");
          }

          b.Append("}");

          if (jump != path[path.Count - 1])
              b.Append(",\n");
      }
      b.Append("] }");

      response.ContentType = "application/json";
      RespondWith(response, b.ToString());

      return true;
  }

  static void RespondWith(HttpListenerResponse resp, string text) {
        var bytes = Encoding.UTF8.GetBytes(text);
        RespondWith(resp, bytes);
  }
  static void RespondWith(HttpListenerResponse resp, byte[] bytes) {
      var outp = resp.OutputStream;
      using (outp) {
        outp.Write(bytes, 0, bytes.Length);
      }
  }

  static string GenerateRoute(string nameStart, string nameEnd) {
    var start = LookupSystem(nameStart);
    var end = LookupSystem(nameEnd);
    if (end == null)
      return null;

    var routeParams = new GateRouteParameters();
    routeParams.RoutingOption = GateRouteOption.UseBridges;
    routeParams.ShipMass = 1f;

    var router = new GateRouter(routeParams);
    List<Vertex> path;
    router.GetShortestPath(start, end, out path);

    var b = new StringBuilder();
    foreach (var v in path) {
      var s = v.SolarSystem;
      b.Append(string.Format("{0}:{1}", s.ID, s.Name));
      if (v.JumpType == JumpType.Bridge) {
        var p = v.Bridge.Pos;
        b.Append(string.Format(" @ {0}-{1}", p.Planet, p.Moon));
      }
      b.Append('\n');
    }
    return b.ToString();
  }

  static SolarSystem LookupSystem(string name) {
    var results = GuiTools.SearchForSystem(name, false);
    if (results.Count == 0)
      return null;
    if (results.Count == 1)
      return results[0];
    var result = results.Find(a => a.Name.ToUpper().Equals(name.ToUpper()));
    if (result != null)
      return result;
    return results[0];
  }
}
