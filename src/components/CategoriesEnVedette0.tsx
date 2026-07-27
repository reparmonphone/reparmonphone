"use client";

type Marque = {
  nom: string;
  logo: string;
  image: string;
  modeles: string[];
};

const marques: Marque[] = [
  {
    nom: "Apple",
    logo: "/categories/logo-apple.png",
    image: "/categories/phones-apple.png",
    modeles: ["iPhones", "iPads", "AirPods", "Apple Watch"],
  },
  {
    nom: "Samsung",
    logo: "/categories/logo-samsung.png",
    image: "/categories/phones-samsung.png",
    modeles: [
      "Galaxy A",
      "Galaxy J",
      "Galaxy M",
      "Galaxy Note",
      "Galaxy S",
      "Galaxy Z",
    ],
  },
  {
    nom: "Xiaomi",
    logo: "/categories/logo-xiaomi.png",
    image: "/categories/phones-xiaomi.png",
    modeles: [
      "Redmi Note",
      "Redmi",
      "Mi",
      "Poco",
      "Pad",
    ],
  },
  {
    nom: "Huawei",
    logo: "/categories/logo-huawei.png",
    image: "/categories/phones-huawei.png",
    modeles: [
      "Gamme G",
      "Gamme Mate",
      "Gamme P",
      "Gamme Nova",
      "Gamme Y",
    ],
  },
];

export default function CategoriesEnVedette() {
  return (
    <section className="w-full bg-white py-12">
      <div className="mx-auto w-full max-w-7xl px-4">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {marques.map((marque) => (
            <div
              key={marque.nom}
              className="flex min-h-[610px] flex-col items-center border border-gray-200 bg-white px-5 py-6 text-center"
            >
              {/* Logo de la marque */}
              <div className="flex h-[110px] w-full items-center justify-center">
                <img
                  src={marque.logo}
                  alt={`Logo ${marque.nom}`}
                  className="max-h-[95px] max-w-[210px] object-contain"
                />
              </div>

              {/* Liste des appareils */}
              <div className="mt-6 flex flex-col items-center gap-4">
                {marque.modeles.map((modele) => (
                  <a
                    key={modele}
                    href="#"
                    className="text-[17px] font-medium text-cyan-500 transition-colors hover:text-cyan-700"
                  >
                    {modele}
                  </a>
                ))}
              </div>

              {/* Image des téléphones en bas */}
              <div className="mt-auto flex h-[250px] w-full items-end justify-center pt-8">
                <img
                  src={marque.image}
                  alt={`Téléphones ${marque.nom}`}
                  className="max-h-[240px] max-w-full object-contain"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}