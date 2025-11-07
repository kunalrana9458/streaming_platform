
import Title,{ITitle} from "./catalog.model";



export async function createTitle(data: Partial<ITitle>){
    const title = await Title.create(data)
    return title
}


// this will be the Offset Based Pagination the another one can be Cursor Based Pagination
export async function getAllTitles(page=1,limit=10){
    const skip  = (page-1)*limit;
    const [titles,total] = await Promise.all([
        Title.find().skip(skip).limit(limit).sort({createdAt:-1}),
        Title.countDocuments()
    ])
    return {
        titles,
        total,
        page,
        pages: Math.ceil(total/limit)
    }
}

export async function getTitleById(id:string){
    return await Title.findById(id)
}

export async function updateTitle(id:string,data:Partial<ITitle>) {
    return await Title.findByIdAndUpdate(id,data,{new:true})
}

export async function deleteTitle(id:string) {
    return await Title.findByIdAndDelete(id)
}




// In Cursor Based Pagination we use the last fetched 
// item's unique field to fetch the next set of items
//  for that we maintain cursor but have to create cursor
//  as buffer and encode decode it to prevent the user from
//  tampering it beacue thaat is DB sensitive data
// const MAX_LIMIT = 100;

/**   function encodeCursor(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64');
}

function decodeCursor(cursor) {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
  } catch (e) {
    return null;
  }
}

export async function getAllTitlesCursor({ cursor = null, limit = 10 } = {}) {
  limit = Math.min(Number(limit) || 10, MAX_LIMIT);

  // decode cursor if present
  let cursorObj = null;
  if (cursor) cursorObj = decodeCursor(cursor);

  // build query for "older than cursor" (we sort DESC by createdAt, _id)
  const query = {};
  if (cursorObj && cursorObj.createdAt && cursorObj._id) {
    // createdAt may be stored as ISO string; convert to Date
    const cursorDate = new Date(cursorObj.createdAt);
    const cursorId = cursorObj._id;

    // keyset comparison for composite keys (createdAt, _id)
    query.$or = [
      { createdAt: { $lt: cursorDate } },
      { createdAt: cursorDate, _id: { $lt: cursorId } }
    ];
  }

  // fetch items
  const titles = await Title.find(query)
    .sort({ createdAt: -1, _id: -1 }) // newest first; _id as tiebreaker
    .limit(limit + 1);                 // fetch one extra to determine if there's more

  // determine nextCursor / hasMore
  let hasMore = false;
  let nextCursor = null;
  if (titles.length > limit) {
    hasMore = true;
    const lastItem = titles[limit]; // extra item
    // create cursor from the last returned item (not the extra one)
    const lastReturned = titles[limit - 1];
    nextCursor = encodeCursor({
      createdAt: lastReturned.createdAt.toISOString(),
      _id: lastReturned._id.toString()
    });
    // trim extra item
    titles.splice(limit);
  } else {
    hasMore = false;
    nextCursor = null;
  }

  return {
    titles,
    nextCursor,
    hasMore
  };
} */