import { getShopData, saveShopData } from "./data.js";
import {
  getOrders,
  saveOrders,
  createOrder,
  updateOrderStatus,
  ordersToCsv
} from "./api.js";
import { renderShop } from "./shop.js";
import { renderAdmin } from "./admin.js";

const DEFAULT_PASSWORD = "admin123";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json;charset=UTF-8" }
  });

const html = content =>
  new Response(content, {
    headers: { "Content-Type": "text/html;charset=UTF-8" }
  });

const shopName = request => {
  const url = new URL(request.url);
  return (url.searchParams.get("shop") || "demo")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
};

const getPassword = async (env, shop) =>
  (await env.BOUTIQUEDATA.get(`${shop}:password`)) || DEFAULT_PASSWORD;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const shop = shopName(request);

    try {
      if (path === "/api/data" && request.method === "GET") {
        return json(await getShopData(env, shop));
      }

      if (path === "/api/save" && request.method === "POST") {
        const data = await request.json();
        await saveShopData(env, shop, data);
        return json({ ok: true });
      }

      if (path === "/api/orders" && request.method === "GET") {
        return json(await getOrders(env, shop));
      }

      if (path === "/api/order" && request.method === "POST") {
        const body = await request.json();
        const order = await createOrder(env, shop, body);
        return json({ ok: true, order });
      }

      if (path === "/api/order-status" && request.method === "POST") {
        const body = await request.json();
        await updateOrderStatus(env, shop, body.id, body.status);
        return json({ ok: true });
      }

      if (path === "/api/export" && request.method === "GET") {
        const csv = ordersToCsv(await getOrders(env, shop));

        return new Response(csv, {
          headers: {
            "Content-Type": "text/csv;charset=UTF-8",
            "Content-Disposition":
              `attachment; filename="commandes-${shop}.csv"`
          }
        });
      }

      if (path === "/api/auth" && request.method === "POST") {
        const { password } = await request.json();
        const valid = password === await getPassword(env, shop);
        return json({ ok: valid }, valid ? 200 : 401);
      }

      if (path === "/api/change-password" && request.method === "POST") {
        const { oldPassword, newPassword } = await request.json();

        if (oldPassword !== await getPassword(env, shop)) {
          return json(
            { ok: false, error: "Ancien mot de passe incorrect" },
            401
          );
        }

        await env.BOUTIQUEDATA.put(`${shop}:password`, newPassword);
        return json({ ok: true });
      }

      if (path === "/admin") {
        return html(renderAdmin(shop));
      }

      return html(renderShop(shop));
    } catch (error) {
      return json({ ok: false, error: error.message }, 500);
    }
  }
};

const demoData = () => ({
  branding: {
    nom: "VISION LIBRE",
    slogan: "Votre vision. Aucune limite.",
    logo: "https://via.placeholder.com/150/2563EB/FFFFFF?text=VL",
    banner: "https://via.placeholder.com/600x200/1D4ED8/FFFFFF?text=VISION+LIBRE",
    couleur: "#2563EB",
    couleurBouton: "#0EA5E9",
    bgColor: "#0A0A0A",
    whatsapp: "212655996172",
    messageConfiance: "Livraison rapide - Support réactif sur WhatsApp"
  },

  badges: {
    paiement: true,
    retour: true,
    original: true
  },

  produits: [
    {
      id: 1,
      nom: "Boutique Pro - Site E-commerce Clé en Main",
      desc: "Ta boutique en ligne prête à vendre en 48h.",
      prix: 990,
      prixPromo: 690,
      promo: true,
      promoFin: "2026-12-31T23:59:00",
      stock: 15,
      ventes: 3,
      vues: 0,
      categorie: "Sites Web",
      image1: "https://via.placeholder.com/400/2563EB/FFFFFF?text=Boutique",
      image2: "",
      tags: ["Best-seller"],
      statut: "actif",
      avis: []
    },

    {
      id: 2,
      nom: "Automatisation Marketing Digital",
      desc: "Tunnels automatisés et relances de prospects.",
      prix: 1490,
      prixPromo: 0,
      promo: false,
      promoFin: "",
      stock: 10,
      ventes: 1,
      vues: 0,
      categorie: "Automatisation",
      image1:
        "https://via.placeholder.com/400/2563EB/FFFFFF?text=Automatisation",
      image2: "",
      tags: ["Nouveauté"],
      statut: "actif",
      avis: []
    }
  ],

  popup: {
    actif: false,
    texte: "Promo -10% aujourd’hui !"
  },

  temoignages: [],
  avisAttente: [],
  analytics: {
    visiteurs: {},
    clicsWhatsapp: 0
  }
});

export async function getShopData(env, shop) {
  const key = `${shop}:data`;
  const saved = await env.BOUTIQUEDATA.get(key);

  if (!saved) return demoData();

  const data = JSON.parse(saved);

  data.produits ||= [];
  data.temoignages ||= [];
  data.avisAttente ||= [];
  data.popup ||= { actif: false, texte: "" };
  data.analytics ||= { visiteurs: {}, clicsWhatsapp: 0 };

  data.produits.forEach(product => {
    product.avis ||= [];
    product.tags ||= [];
    product.vues ||= 0;
    product.ventes ||= 0;
    product.stock ||= 0;
    product.promo ||= false;
    product.prixPromo ||= 0;
    product.promoFin ||= "";
    product.image2 ||= "";
  });

  return data;
}

export async function saveShopData(env, shop, data) {
  await env.BOUTIQUEDATA.put(
    `${shop}:data`,
    JSON.stringify(data)
  );
}

export async function getOrders(env, shop) {
  const value = await env.BOUTIQUEDATA.get(`${shop}:orders`);
  return value ? JSON.parse(value) : [];
}

export async function saveOrders(env, shop, orders) {
  await env.BOUTIQUEDATA.put(
    `${shop}:orders`,
    JSON.stringify(orders)
  );
}

export async function createOrder(env, shop, body) {
  const orders = await getOrders(env, shop);

  const order = {
    id: Date.now(),
    date: new Date().toISOString().slice(0, 10),
    client: body.client || "",
    tel: body.tel || "",
    ville: body.ville || "",
    produits: body.produits || "",
    total: body.total || 0,
    statut: "Nouvelle"
  };

  orders.push(order);
  await saveOrders(env, shop, orders);

  return order;
}

export async function updateOrderStatus(env, shop, id, status) {
  const orders = await getOrders(env, shop);
  const order = orders.find(item => item.id === id);

  if (order) {
    order.statut = status;
    await saveOrders(env, shop, orders);
  }
}

export function ordersToCsv(orders) {
  const header = "Date,Client,Telephone,Ville,Produits,Total,Statut";

  const rows = orders.map(order =>
    [
      order.date,
      order.client,
      order.tel,
      order.ville,
      order.produits,
      order.total,
      order.statut
    ]
      .map(value => `"${String(value || "").replaceAll('"', '""')}"`)
      .join(",")
  );

  return [header, ...rows].join("
");
}
