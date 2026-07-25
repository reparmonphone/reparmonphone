'use client';

const FB_PAGE_URL = 'https://www.facebook.com/ReparMonPhone';

export default function FacebookPageWidget() {
  const embedSrc = `https://www.facebook.com/plugins/page.php?href=${encodeURIComponent(
    FB_PAGE_URL
  )}&tabs=&width=340&height=70&small_header=true&adapt_container_width=true&hide_cover=true&show_facepile=false&appId`;

  return (
    <div className="bg-white border-b border-gray-100 py-3">
      <div className="max-w-6xl mx-auto px-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Widget officiel Facebook : affiche la photo de page + nombre de J'aime */}
          <iframe
            src={embedSrc}
            width="340"
            height="70"
            style={{ border: 'none', overflow: 'hidden' }}
            scrolling="no"
            frameBorder="0"
            allowFullScreen
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
            title="Page Facebook ReparMonPhone"
          />
        </div>
        <a
          href={FB_PAGE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 bg-[#1877F2] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#0f5fcc] transition shrink-0"
        >
          👍 Suivre la page
        </a>
      </div>
    </div>
  );
}
