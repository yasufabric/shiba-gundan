# 柴犬軍団

スマホの縦画面で、柴犬の隊長と豆柴の隊列が前へ進み、指で左右に動かすゲーム。
道の門をくぐると豆柴が増え、前から来る猫の群れを撃ち、最後の猫を倒せばクリア。

## 遊ぶ

**https://yasufabric.github.io/shiba-gundan/** （スマホの縦画面推奨）

## 遊び方

説明は出さない。最初から隊列が道にいて、弾は前に飛び続ける。指を左右に滑らせると、隊長ごと動く。

- 豆柴は1匹から。門は青（`+` `×`）と赤（`−` `÷`）。弾が1発当たるたびに、その門の数字が1増える。赤い門も撃ち続けると青に変わる。うまく選んでいるときの匹数だと、その変化に約2.5秒かかる。数字が変わるときは門が光って跳ねる。最初の2組は、どちらをくぐっても増える青い門だけ。赤い門は、始まってから15秒をすぎてから出る。15秒をすぎた × は、撃って育てても ×2 で止まる。
- 一番いい門の手前にドラム缶があることがある。撃つと壊せる。隊列がぶつかると豆柴が減る。
- 弾は隊列の正面にだけ飛ぶ。隊列の横幅は道の3分の1までで、それ以上増えた分は後ろへ伸びる。画面に描く豆柴は80匹までで、超えた分は間隔を詰めて、頭上の数字を大きくする。
- 猫は前から群れで来る。後半の群れの大きさは、300匹の想定で決めた固定値で、実際の匹数では変えない。隊列に重なった猫だけが、1匹につき豆柴を1匹連れていく。うまく選べていても1つの群れで1〜2割減る。門を半分外すと、1つの群れで3割以上減る。0匹で負け。1タップで同じステージのやり直し。
- 最後にボス猫。奥からゆっくり歩いてきて、およそ20秒で隊列に届く。届いたときにまだ生きていれば負け。300匹なら約12秒、150匹なら届く直前で倒せる。ボス戦のあいだ、画面の隊長アイコンを押すとロケット弾が飛ぶ。倒すと少し強い次のステージ。
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
