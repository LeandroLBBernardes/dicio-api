import { Response, Request } from 'express';
import * as cheerio from 'cheerio';
import IMeaning from './interfaces/IMeaning';
import sanitizeWord from './utils/sanitizeWord';
import axiosClient from './services/axiosClient';

async function getCorrectLink(word: string) {
  const url = `/pesquisa.php?q=${word}`;
  const { data: search } = await axiosClient.get(url);

  const $Search = cheerio.load(search);

  const words = $Search('.resultados a').find('.list-link').toArray();
  const [correctWordVariation] = words.filter((variation) => $Search(variation).text() === word);
  const link = correctWordVariation.parentNode
    ? $Search(correctWordVariation.parentNode).attr('href')
    : '';

  return link || word;
}

export default async function controller(req: Request, res: Response) {
  const { word } = req.params;
  const sanitizedWord = sanitizeWord(word);

  try {
    const link = sanitizedWord !== word ? await getCorrectLink(sanitizedWord) : sanitizedWord;

    const { data: dicioHTML } = await axiosClient.get(link);
    const $ = cheerio.load(dicioHTML);

    const meanings: IMeaning[] = [];
    const structure = {
      class: '',
      meanings: [],
      etymology: '',

    };

    meanings.push(structure);

    $('.significado span').each((_, element) => {
      const text = $(element).text();
      const cheerioElement = $(element);

      if (cheerioElement.hasClass('cl')) {
        if (
          meanings.length === 1
          && meanings[0].class === ''
          && meanings[0].meanings.length === 0
        ) {
          meanings[0].class = text;
        } else {
          meanings.push({ class: text, meanings: [], etymology: '' });
        }
      } else if (cheerioElement.hasClass('etim')) {
        meanings[meanings.length - 1].etymology = text;
      } else if (!cheerioElement.hasClass('tag')) {
        meanings[meanings.length - 1].meanings.push(text);
      }
    });

    if ($('.conjugacao').html()) meanings.push({ ...structure, meanings: [] });

    $('.conjugacao span').each((_, element) => {
      const text = $(element).text();
      const cheerioElement = $(element);

      if (cheerioElement.hasClass('etim')) {
        meanings[meanings.length - 1].etymology = text;
      } else if (!cheerioElement.hasClass('tag')) {
        meanings[meanings.length - 1].meanings.push(text);
      }
    });

    res.json(meanings);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}
