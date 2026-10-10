# 柴犬軍団

スマホの縦画面で、柴犬の隊長と豆柴の隊列を左右に滑らせ、前から来る猫を撃ち倒すゲーム。
道の門をくぐると豆柴が増減し、木箱を壊すと武器が強くなる。巨大な猫を倒せばクリア。

## 遊ぶ

**https://yasufabric.github.io/shiba-gundan/** （スマホの縦画面推奨）

## 遊び方

説明は出さない。最初から隊列が道にいて、弾は前に飛び続ける。指を左右に滑らせると、隊長ごと動く。

- 青い門（`+5` `×2`）をくぐると豆柴が増える。赤い門（`−5` `武器↓`）で減る、または武器が1段下がる。
- 最初の門は左右とも青で、5匹からはどちらを通っても10匹になる。
- 木箱を撃つと武器が1段上がる。豆鉄砲、連射、3方向撃ち。
- 猫に触れると、触れた数だけ豆柴が減る。0匹で負け。1タップで同じステージのやり直し。
- 約45秒でボス猫。倒すと少し強い次のステージ。
- 左上の **おと** でミュート。効果音は Web Audio の合成のみ。進行は保存しない。

## 技術スタック

- [Vite](https://vitejs.dev/) + TypeScript（開発サーバー・ビルドのみ、フレームワークなし）
- HTML5 Canvas 2D
- 効果音は Web Audio API。音声ファイルも実行時ライブラリもなし
- 隊長はマッスルひらりと同じ柴犬（[deep-three](https://github.com/yasufabric/deep-three) の絵）
- 表示フォントは [Dela Gothic One](https://fonts.google.com/specimen/Dela+Gothic+One)（SIL Open Font License、`src/assets/fonts/OFL.txt`）

## 開発

```bash
npm install
npm run dev
```

`npm run dev` は `--host` 付き。公開パスは `/shiba-gundan/` なので、
ローカルでは `http://localhost:5173/shiba-gundan/` を開く。
スマホは同じ Wi-Fi の LAN URL、PC では幅 390 前後。

## ビルド

```bash
npm test
npm run build   # tsc --noEmit のあと vite build で dist/ を生成
npm run preview
```

GitHub Pages へのデプロイは `main` への push で `.github/workflows/deploy.yml` が行う。
リポジトリの Settings > Pages > Build and deployment > Source を **GitHub Actions** にしておく。
