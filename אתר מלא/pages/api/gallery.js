// pages/api/gallery.js
import fs from "fs";
import path from "path";

export default function handler(req, res) {
  const imagesDir = path.join(process.cwd(), "public/images2");
  const videosDir = path.join(process.cwd(), "public/videos2");

  const imageFiles = [];
  const videoFiles = [];

  // בדיקת תמונות JPG או PNG
  if (fs.existsSync(imagesDir)) {
    for (let i = 1; i <= 50; i++) {
      const jpg = `img${i}.jpg`;
      const png = `img${i}.png`;
      if (fs.existsSync(path.join(imagesDir, jpg))) {
        imageFiles.push(`/images2/${jpg}`);
      } else if (fs.existsSync(path.join(imagesDir, png))) {
        imageFiles.push(`/images2/${png}`);
      }
    }
  }

  // בדיקת סרטונים MP4
  if (fs.existsSync(videosDir)) {
    for (let i = 1; i <= 20; i++) {
      const fileName = `vid${i}.mp4`;
      if (fs.existsSync(path.join(videosDir, fileName))) {
        videoFiles.push(`/videos2/${fileName}`);
      }
    }
  }

  res.status(200).json({ images: imageFiles, videos: videoFiles });
}
