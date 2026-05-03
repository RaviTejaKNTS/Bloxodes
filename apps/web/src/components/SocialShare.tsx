import {
  FaDiscord,
  FaFacebook,
  FaTelegram,
  FaWhatsapp,
  FaXTwitter,
} from "react-icons/fa6";

type SocialShareProps = {
  url: string;
  title: string;
  heading?: string;
  analytics?: {
    contentType: string;
    itemId: string;
  };
};

export function SocialShare({
  url,
  title,
  heading = "Share these codes with your friends",
  analytics
}: SocialShareProps) {
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const socialLinks = [
    {
      name: "Discord",
      icon: <FaDiscord />,
      // Discord doesn't have a direct share link, this is a placeholder.
      // A real implementation might involve a server-side bot or a simple copy-to-clipboard.
      url: `https://discord.com/app`,
      color: "bg-[#5865F2] text-white hover:bg-[#5865F2]/90",
    },
    {
      name: "Twitter",
      icon: <FaXTwitter />,
      url: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
      color: "bg-[#000000] text-white hover:bg-[#000000]/85",
    },
    {
      name: "Facebook",
      icon: <FaFacebook />,
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      color: "bg-[#1877F2] text-white hover:bg-[#1877F2]/90",
    },
    {
      name: "WhatsApp",
      icon: <FaWhatsapp />,
      url: `https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`,
      color: "bg-[#25D366] text-white hover:bg-[#25D366]/90",
    },
    {
      name: "Telegram",
      icon: <FaTelegram />,
      url: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
      color: "bg-[#24A1DE] text-white hover:bg-[#24A1DE]/90",
    },
  ];

  return (
    <div className="space-y-3 px-1 py-1">
      <h3 className="text-base font-semibold leading-6 text-foreground">{heading}</h3>
      <div className="flex flex-wrap items-center gap-2">
        {socialLinks.map((social) => {
          const analyticsAttrs = analytics
            ? {
                "data-analytics-event": "share",
                "data-analytics-method": social.name.toLowerCase(),
                "data-analytics-content-type": analytics.contentType,
                "data-analytics-item-id": analytics.itemId
              }
            : {};
          return (
            <a
              key={social.name}
              href={social.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Share on ${social.name}`}
              {...analyticsAttrs}
              className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ring ${social.color}`}
            >
              <span className="text-base">{social.icon}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
