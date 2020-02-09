import { H3, P } from '../VTheme/VTheme'
import Button from 'antd/lib/button'
import moment from 'moment'

export const StoryDetail = ({ story, children }) =>

  <article>
    <H3>{story.name}</H3>
    {story.imgUrl && <img src={story.imgUrl} />}
    <P> {story.body} </P>
    {children}

    <footer>
      <span item={story.author} path='author'>{story.author && story.author.name}</span> &nbsp;
      <span>{moment(story.dateAdded).fromNow()}</span>
      {children}
    </footer>
    <br />
    <Button shape='round' type='secondary'>Reply</Button>
  </article>

export default StoryDetail
