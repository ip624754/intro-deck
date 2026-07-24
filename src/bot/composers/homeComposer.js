import { Composer } from 'grammy';
import { safeEditOrReply } from '../../lib/telegram/safeEditOrReply.js';
import { createLanguageComposer } from './languageComposer.js';

export function createHomeComposer({
  buildHomeSurface,
  buildHelpSurface,
  buildLanguageSettingsSurface,
  clearAllPendingInputs
}) {
  const composer = new Composer();
  composer.use(createLanguageComposer({ clearAllPendingInputs, buildLanguageSettingsSurface }));

  const renderHome = async (ctx, method = 'edit') => {
    await clearAllPendingInputs(ctx.from.id);
    const surface = await buildHomeSurface(ctx);
    if (method === 'reply') {
      await ctx.reply(surface.text, { reply_markup: surface.reply_markup });
      return;
    }
    await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup });
  };

  const renderHelp = async (ctx, method = 'edit') => {
    await clearAllPendingInputs(ctx.from.id);
    const surface = await buildHelpSurface(ctx);
    if (method === 'reply') {
      await ctx.reply(surface.text, { reply_markup: surface.reply_markup });
      return;
    }
    await safeEditOrReply(ctx, surface.text, { reply_markup: surface.reply_markup });
  };


  composer.command('menu', async (ctx) => {
    await renderHome(ctx, 'reply');
  });

  composer.command('help', async (ctx) => {
    await renderHelp(ctx, 'reply');
  });

  composer.callbackQuery('home:root', async (ctx) => {
    await ctx.answerCallbackQuery();
    await renderHome(ctx, 'edit');
  });

  composer.callbackQuery('help:root', async (ctx) => {
    await ctx.answerCallbackQuery();
    await renderHelp(ctx, 'edit');
  });

  return composer;
}
