// Icon generation script
// In actual implementation, use canvas or sharp library to generate icons
// Here we simply create SVG files

const fs = require('fs')
const path = require('path')

const iconSvg = `<svg width="192" height="192" viewBox="0 0 192 192" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="192" height="192" rx="40" fill="#0366d6"/>
  <path d="M96 48C69.5 48 48 69.5 48 96C48 122.5 69.5 144 96 144C122.5 144 144 122.5 144 96C144 69.5 122.5 48 96 48ZM96 60C115.9 60 132 76.1 132 96C132 115.9 115.9 132 96 132C76.1 132 60 115.9 60 96C60 76.1 76.1 60 96 60Z" fill="white"/>
  <circle cx="96" cy="96" r="24" fill="white"/>
</svg>`

const icon512Svg = `<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="106" fill="#0366d6"/>
  <path d="M256 128C185.3 128 128 185.3 128 256C128 326.7 185.3 384 256 384C326.7 384 384 326.7 384 256C384 185.3 326.7 128 256 128ZM256 160C309.0 160 352 203.0 352 256C352 309.0 309.0 352 256 352C203.0 352 160 309.0 160 256C160 203.0 203.0 160 256 160Z" fill="white"/>
  <circle cx="256" cy="256" r="64" fill="white"/>
</svg>`

const badgeSvg = `<svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="36" cy="36" r="36" fill="#ff0000"/>
</svg>`

// Save icons
const publicDir = path.join(__dirname, '../client/public')

// Save as SVG files (need to convert to PNG for actual use)
fs.writeFileSync(path.join(publicDir, 'icon-192.svg'), iconSvg)
fs.writeFileSync(path.join(publicDir, 'icon-512.svg'), icon512Svg)
fs.writeFileSync(path.join(publicDir, 'badge-72.svg'), badgeSvg)

// Simply copy SVG files as PNG for basic usage
// In actual implementation, convert to PNG using sharp or canvas
fs.copyFileSync(path.join(publicDir, 'icon-192.svg'), path.join(publicDir, 'icon-192.png'))
fs.copyFileSync(path.join(publicDir, 'icon-512.svg'), path.join(publicDir, 'icon-512.png'))
fs.copyFileSync(path.join(publicDir, 'badge-72.svg'), path.join(publicDir, 'badge-72.png'))

console.log('Icons generated successfully!')
